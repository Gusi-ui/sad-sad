import {
  classifyDay,
  isoWeekKeyUtc,
  loadHolidayDatesInRange,
  slotDurationMinutes,
  templatesApplicableForDay,
  type ServiceTemplateRow,
  type DayKind
} from './month-hours';

// Tipado mínimo compatible sin depender de @cloudflare/workers-types.
export type D1DatabaseLike = {
  prepare: (query: string) => {
    bind: (...args: unknown[]) => {
      all: <T>() => Promise<{ results: T[] }>;
      first: <T>() => Promise<T | null>;
    };
  };
};

const pad2 = (n: number) => String(n).padStart(2, '0');

export const monthRangeUtc = (year: number, month: number) => {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const toYmd = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  return { start, end, startYmd: toYmd(start), endYmd: toYmd(end), daysInMonth: end.getUTCDate() };
};

export const ymdToUtcDate = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

export const hours = (minutes: number) => minutes / 60;

export type UserBalanceDay = {
  ymd: string;
  weekday0to6: number;
  kind: DayKind;
  source: 'assignments' | 'templates' | 'none';
  plannedMinutes: number;
  workers: { id: string; name: string }[];
};

export type UserBalanceWeek = {
  weekKey: string;
  startYmd: string;
  endYmd: string;
  plannedMinutes: number;
};

export type UserBalanceDetail = {
  year: number;
  month: number;
  startYmd: string;
  endYmd: string;
  user: { id: string; name: string; monthly_hours_quota: number | null };
  quotaHours: number | null;
  plannedMinutes: number;
  deltaHours: number | null;
  days: UserBalanceDay[];
  weeks: UserBalanceWeek[];
};

export type WorkerBalanceDay = {
  ymd: string;
  weekday0to6: number;
  kind: DayKind;
  plannedMinutes: number;
  breakMinutes: number;
  travelMinutes: number;
  payableMinutes: number;
  users: { id: string; name: string }[];
};

export type WorkerBalanceWeek = {
  weekKey: string;
  startYmd: string;
  endYmd: string;
  plannedMinutes: number;
};

export type WorkerBalanceDetail = {
  year: number;
  month: number;
  startYmd: string;
  endYmd: string;
  worker: { id: string; name: string };
  contractHoursPerWeek: number | null;
  contractHoursPerMonth: number | null;
  plannedMinutes: number;
  breakMinutes: number;
  travelMinutes: number;
  payableMinutes: number;
  deltaHoursVsMonth: number | null;
  avgWeeklyPlannedHours: number;
  days: WorkerBalanceDay[];
  weeks: WorkerBalanceWeek[];
};

const dedupeById = <T extends { id: string }>(items: T[]) => {
  const m = new Map<string, T>();
  for (const it of items) m.set(it.id, it);
  return Array.from(m.values());
};

export const computeUsersMinutesForMonth = async (db: D1DatabaseLike, year: number, month: number) => {
  const { startYmd, endYmd } = monthRangeUtc(year, month);
  const rows = await db
    .prepare(
      `SELECT service_user_id, planned_start, planned_end
       FROM assignments
       WHERE date >= ? AND date <= ? AND status != 'cancelled'`
    )
    .bind(startYmd, endYmd)
    .all<{ service_user_id: string; planned_start: string; planned_end: string }>();

  const minutesByUser = new Map<string, number>();
  for (const r of rows.results) {
    const m = slotDurationMinutes(r.planned_start, r.planned_end);
    minutesByUser.set(r.service_user_id, (minutesByUser.get(r.service_user_id) ?? 0) + m);
  }
  return minutesByUser;
};

/**
 * Minutos mensuales previstos por usuario, usando:
 * - Assignments si existen para el día
 * - Si NO existen assignments para ese día, se usa la suma teórica de sus plantillas (service_templates)
 *
 * Esto permite que el admin vea el mes completo aunque aún no se haya “generado” cada día en assignments.
 */
export const computeUsersForecastMinutesForMonth = async (
  db: D1DatabaseLike,
  userIds: string[],
  year: number,
  month: number
) => {
  const { startYmd, endYmd, daysInMonth } = monthRangeUtc(year, month);
  const holidayDates = await loadHolidayDatesInRange(db as any, startYmd, endYmd);

  if (userIds.length === 0) return new Map<string, number>();
  const placeholders = userIds.map(() => '?').join(',');

  const tplRows = await db
    .prepare(
      `SELECT service_user_id, kind, weekday, start_time, end_time
       FROM service_templates
       WHERE service_user_id IN (${placeholders})
       ORDER BY service_user_id, kind, weekday, start_time`
    )
    .bind(...userIds)
    .all<{ service_user_id: string } & ServiceTemplateRow>();

  const templatesByUser = new Map<string, ServiceTemplateRow[]>();
  for (const r of tplRows.results) {
    const arr = templatesByUser.get(r.service_user_id) ?? [];
    arr.push({ kind: r.kind, weekday: r.weekday, start_time: r.start_time, end_time: r.end_time });
    templatesByUser.set(r.service_user_id, arr);
  }

  const assignRows = await db
    .prepare(
      `SELECT service_user_id, date, planned_start, planned_end
       FROM assignments
       WHERE service_user_id IN (${placeholders})
         AND date >= ? AND date <= ?
         AND status != 'cancelled'`
    )
    .bind(...userIds, startYmd, endYmd)
    .all<{ service_user_id: string; date: string; planned_start: string; planned_end: string }>();

  const assignmentMinutesByUserDate = new Map<string, number>();
  const key = (uid: string, ymd: string) => `${uid}::${ymd}`;
  for (const r of assignRows.results) {
    const k = key(r.service_user_id, r.date);
    assignmentMinutesByUserDate.set(k, (assignmentMinutesByUserDate.get(k) ?? 0) + slotDurationMinutes(r.planned_start, r.planned_end));
  }

  const totals = new Map<string, number>();
  for (const uid of userIds) totals.set(uid, 0);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(Date.UTC(year, month - 1, day));
    const ymd = `${year}-${pad2(month)}-${pad2(day)}`;
    const weekday = d.getUTCDay();
    const kind = classifyDay(ymd, weekday, holidayDates);

    for (const uid of userIds) {
      const existing = assignmentMinutesByUserDate.get(key(uid, ymd));
      if (existing !== undefined) {
        totals.set(uid, (totals.get(uid) ?? 0) + existing);
      } else {
        const tpls = templatesByUser.get(uid) ?? [];
        const applicable = templatesApplicableForDay(tpls, kind, weekday);
        let tplMinutes = 0;
        for (const t of applicable) tplMinutes += slotDurationMinutes(t.start_time, t.end_time);
        totals.set(uid, (totals.get(uid) ?? 0) + tplMinutes);
      }
    }
  }

  return totals;
};

export const computeWorkersMinutesForMonth = async (db: D1DatabaseLike, year: number, month: number) => {
  const { startYmd, endYmd } = monthRangeUtc(year, month);
  const rows = await db
    .prepare(
      `SELECT assigned_worker_id, planned_start, planned_end
       FROM assignments
       WHERE assigned_worker_id IS NOT NULL AND date >= ? AND date <= ? AND status != 'cancelled'`
    )
    .bind(startYmd, endYmd)
    .all<{ assigned_worker_id: string; planned_start: string; planned_end: string }>();

  const minutesByWorker = new Map<string, number>();
  for (const r of rows.results) {
    const m = slotDurationMinutes(r.planned_start, r.planned_end);
    minutesByWorker.set(r.assigned_worker_id, (minutesByWorker.get(r.assigned_worker_id) ?? 0) + m);
  }
  return minutesByWorker;
};

export const computeUserBalanceDetail = async (
  db: D1DatabaseLike,
  userId: string,
  year: number,
  month: number
): Promise<UserBalanceDetail | null> => {
  const { startYmd, endYmd, daysInMonth } = monthRangeUtc(year, month);

  const user = await db
    .prepare(`SELECT id, name, monthly_hours_quota FROM service_users WHERE id = ? LIMIT 1`)
    .bind(userId)
    .first<{ id: string; name: string; monthly_hours_quota: number | null }>();
  if (!user) return null;

  const holidayDates = await loadHolidayDatesInRange(db as any, startYmd, endYmd);

  const tplRows = await db
    .prepare(
      `SELECT kind, weekday, start_time, end_time
       FROM service_templates
       WHERE service_user_id = ?
       ORDER BY kind, weekday, start_time`
    )
    .bind(userId)
    .all<ServiceTemplateRow>();
  const templates = tplRows.results;

  const rows = await db
    .prepare(
      `SELECT a.date, a.planned_start, a.planned_end,
              w.id as worker_id, w.name as worker_name
       FROM assignments a
       LEFT JOIN workers w ON w.id = a.assigned_worker_id
       WHERE a.service_user_id = ? AND a.date >= ? AND a.date <= ? AND a.status != 'cancelled'
       ORDER BY a.date ASC, a.planned_start ASC`
    )
    .bind(userId, startYmd, endYmd)
    .all<{ date: string; planned_start: string; planned_end: string; worker_id: string | null; worker_name: string | null }>();

  const minutesByDate = new Map<string, number>();
  const workersByDate = new Map<string, { id: string; name: string }[]>();
  for (const r of rows.results) {
    minutesByDate.set(r.date, (minutesByDate.get(r.date) ?? 0) + slotDurationMinutes(r.planned_start, r.planned_end));
    if (r.worker_id && r.worker_name) {
      const arr = workersByDate.get(r.date) ?? [];
      arr.push({ id: r.worker_id, name: r.worker_name });
      workersByDate.set(r.date, arr);
    }
  }

  const days: UserBalanceDay[] = [];
  let plannedMinutes = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(Date.UTC(year, month - 1, day));
    const ymd = `${year}-${pad2(month)}-${pad2(day)}`;
    const weekday = d.getUTCDay();
    const kind = classifyDay(ymd, weekday, holidayDates);
    const assignMins = minutesByDate.get(ymd);
    let m = 0;
    let source: UserBalanceDay['source'] = 'none';
    if (assignMins !== undefined) {
      m = assignMins;
      source = 'assignments';
    } else {
      // Forecast: si todavía no se han materializado assignments, usamos plantillas.
      const applicable = templatesApplicableForDay(templates, kind, weekday);
      for (const t of applicable) m += slotDurationMinutes(t.start_time, t.end_time);
      source = m > 0 ? 'templates' : 'none';
    }
    plannedMinutes += m;
    days.push({
      ymd,
      weekday0to6: weekday,
      kind,
      source,
      plannedMinutes: m,
      workers: dedupeById(workersByDate.get(ymd) ?? [])
    });
  }

  const weekMap = new Map<
    string,
    { minutes: number; startYmd: string; endYmd: string }
  >();
  for (const d of days) {
    const dt = ymdToUtcDate(d.ymd);
    const wk = isoWeekKeyUtc(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
    const existing = weekMap.get(wk);
    if (!existing) {
      weekMap.set(wk, { minutes: d.plannedMinutes, startYmd: d.ymd, endYmd: d.ymd });
    } else {
      existing.minutes += d.plannedMinutes;
      if (d.ymd < existing.startYmd) existing.startYmd = d.ymd;
      if (d.ymd > existing.endYmd) existing.endYmd = d.ymd;
    }
  }
  const weeks: UserBalanceWeek[] = Array.from(weekMap.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([weekKey, v]) => ({ weekKey, startYmd: v.startYmd, endYmd: v.endYmd, plannedMinutes: v.minutes }));

  const quotaHours = user.monthly_hours_quota;
  const deltaHours = quotaHours === null ? null : hours(plannedMinutes) - quotaHours;

  return {
    year,
    month,
    startYmd,
    endYmd,
    user,
    quotaHours,
    plannedMinutes,
    deltaHours,
    days,
    weeks
  };
};

export const computeWorkerBalanceDetail = async (
  db: D1DatabaseLike,
  workerId: string,
  year: number,
  month: number
): Promise<WorkerBalanceDetail | null> => {
  const { startYmd, endYmd, daysInMonth } = monthRangeUtc(year, month);

  const worker = await db
    .prepare(`SELECT id, name FROM workers WHERE id = ? LIMIT 1`)
    .bind(workerId)
    .first<{ id: string; name: string }>();
  if (!worker) return null;

  const holidayDates = await loadHolidayDatesInRange(db as any, startYmd, endYmd);

  const contracts = await db
    .prepare(`SELECT hours_per_week, hours_per_month, start_date, end_date FROM worker_contracts WHERE worker_id = ?`)
    .bind(workerId)
    .all<{ hours_per_week: number; hours_per_month: number | null; start_date: string; end_date: string | null }>();

  // Reutilizamos la misma lógica que ya existe en month-hours (sin importar para evitar circularidad).
  const pickContractForMonth = (items: typeof contracts.results, y: number, m: number) => {
    const first = `${y}-${pad2(m)}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const last = `${y}-${pad2(m)}-${pad2(lastDay)}`;
    const sorted = [...items].sort((a, b) => (a.start_date < b.start_date ? 1 : a.start_date > b.start_date ? -1 : 0));
    for (const c of sorted) {
      if (c.start_date <= last && (!c.end_date || c.end_date >= first)) return c;
    }
    return null;
  };
  const contract = pickContractForMonth(contracts.results, year, month);

  const rows = await db
    .prepare(
      `SELECT a.date, a.planned_start, a.planned_end,
              su.id as user_id, su.name as user_name
       FROM assignments a
       JOIN service_users su ON su.id = a.service_user_id
       WHERE a.assigned_worker_id = ? AND a.date >= ? AND a.date <= ? AND a.status != 'cancelled'
       ORDER BY a.date ASC, a.planned_start ASC`
    )
    .bind(workerId, startYmd, endYmd)
    .all<{ date: string; planned_start: string; planned_end: string; user_id: string; user_name: string }>();

  // Extras por día (desplazamiento)
  const extrasRows = await db
    .prepare(
      `SELECT date, travel_minutes
       FROM worker_day_extras
       WHERE worker_id = ? AND date >= ? AND date <= ?`
    )
    .bind(workerId, startYmd, endYmd)
    .all<{ date: string; travel_minutes: number }>();
  const travelByDate = new Map<string, number>(extrasRows.results.map((r) => [r.date, r.travel_minutes ?? 0]));

  const minutesByDate = new Map<string, number>();
  const usersByDate = new Map<string, { id: string; name: string }[]>();
  for (const r of rows.results) {
    minutesByDate.set(r.date, (minutesByDate.get(r.date) ?? 0) + slotDurationMinutes(r.planned_start, r.planned_end));
    const arr = usersByDate.get(r.date) ?? [];
    arr.push({ id: r.user_id, name: r.user_name });
    usersByDate.set(r.date, arr);
  }

  const days: WorkerBalanceDay[] = [];
  let plannedMinutes = 0;
  let breakMinutesTotal = 0;
  let travelMinutesTotal = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(Date.UTC(year, month - 1, day));
    const ymd = `${year}-${pad2(month)}-${pad2(day)}`;
    const weekday = d.getUTCDay();
    const kind = classifyDay(ymd, weekday, holidayDates);
    const m = minutesByDate.get(ymd) ?? 0;
    plannedMinutes += m;
    // Descanso: si la trabajadora hace MÁS de 6 horas de servicios en ese día, se suman 20 min.
    const breakMinutes = m > 6 * 60 ? 20 : 0;
    const travelMinutes = Math.max(0, Number(travelByDate.get(ymd) ?? 0) || 0);
    const payableMinutes = m + breakMinutes + travelMinutes;
    breakMinutesTotal += breakMinutes;
    travelMinutesTotal += travelMinutes;
    days.push({
      ymd,
      weekday0to6: weekday,
      kind,
      plannedMinutes: m,
      breakMinutes,
      travelMinutes,
      payableMinutes,
      users: dedupeById(usersByDate.get(ymd) ?? [])
    });
  }

  const weekMap = new Map<string, { minutes: number; startYmd: string; endYmd: string }>();
  for (const d of days) {
    const dt = ymdToUtcDate(d.ymd);
    const wk = isoWeekKeyUtc(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
    const existing = weekMap.get(wk);
    if (!existing) {
      weekMap.set(wk, { minutes: d.plannedMinutes, startYmd: d.ymd, endYmd: d.ymd });
    } else {
      existing.minutes += d.plannedMinutes;
      if (d.ymd < existing.startYmd) existing.startYmd = d.ymd;
      if (d.ymd > existing.endYmd) existing.endYmd = d.ymd;
    }
  }
  const weeks: WorkerBalanceWeek[] = Array.from(weekMap.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([weekKey, v]) => ({ weekKey, startYmd: v.startYmd, endYmd: v.endYmd, plannedMinutes: v.minutes }));

  const isoWeeksInMonth = new Set(days.map((d) => {
    const dt = ymdToUtcDate(d.ymd);
    return isoWeekKeyUtc(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
  })).size;
  const payableMinutes = plannedMinutes + breakMinutesTotal + travelMinutesTotal;
  const avgWeeklyPlannedHours = isoWeeksInMonth > 0 ? hours(payableMinutes) / isoWeeksInMonth : 0;

  const contractHoursPerWeek = contract?.hours_per_week ?? null;
  const contractHoursPerMonth = contract?.hours_per_month ?? null;
  const deltaHoursVsMonth = contractHoursPerMonth === null ? null : hours(payableMinutes) - contractHoursPerMonth;

  return {
    year,
    month,
    startYmd,
    endYmd,
    worker,
    contractHoursPerWeek,
    contractHoursPerMonth,
    plannedMinutes,
    breakMinutes: breakMinutesTotal,
    travelMinutes: travelMinutesTotal,
    payableMinutes,
    deltaHoursVsMonth,
    avgWeeklyPlannedHours,
    days,
    weeks
  };
};
