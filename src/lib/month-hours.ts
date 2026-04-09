type D1Like = {
  prepare: (query: string) => {
    bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }> };
  };
};

export const HOLIDAY_SCOPES = ['national', 'catalonia', 'barcelona', 'mataro'] as const;

export type DayKind = 'laborable' | 'festivo' | 'fin_semana';

export type ServiceTemplateRow = {
  kind: 'laborable' | 'festivo';
  weekday: number | null;
  start_time: string;
  end_time: string;
};

export const timeToMinutes = (hhmm: string) => {
  const [hRaw, mRaw] = hhmm.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

export const slotDurationMinutes = (start: string, end: string) => {
  const a = timeToMinutes(start);
  const b = timeToMinutes(end);
  if (a === null || b === null) return 0;
  return Math.max(0, b - a);
};

export const classifyDay = (dateYmd: string, weekday0to6: number, holidayDates: Set<string>): DayKind => {
  if (holidayDates.has(dateYmd)) return 'festivo';
  if (weekday0to6 === 0 || weekday0to6 === 6) return 'fin_semana';
  return 'laborable';
};

export const templatesApplicableForDay = (templates: ServiceTemplateRow[], kind: DayKind, weekday0to6: number) =>
  templates.filter((t) => {
    if (kind === 'laborable') {
      if (t.kind !== 'laborable') return false;
      if (t.weekday === null) return true;
      return t.weekday === weekday0to6;
    }
    if (t.kind !== 'festivo') return false;
    if (t.weekday === null) return true;
    return t.weekday === weekday0to6;
  });

export const loadHolidayDatesInRange = async (db: D1Like, startYmd: string, endYmd: string) => {
  const rows = await db
    .prepare(
      `SELECT date FROM holidays WHERE date >= ? AND date <= ? AND scope IN (${HOLIDAY_SCOPES.map(() => '?').join(',')})`
    )
    .bind(startYmd, endYmd, ...HOLIDAY_SCOPES)
    .all<{ date: string }>();
  return new Set(rows.results.map((r) => r.date));
};

export type UserMonthBreakdown = {
  year: number;
  month: number;
  startYmd: string;
  endYmd: string;
  daysLaborable: number;
  daysFestivo: number;
  daysFinSemana: number;
  /** Minutos teóricos según plantillas (como genera la agenda) */
  plannedMinutesFromTemplates: number;
  /** Minutos en assignments existentes del mes (cualquier estado planned) */
  plannedMinutesFromAssignments: number;
};

export const computeUserMonthBreakdown = async (
  db: D1Like,
  serviceUserId: string,
  year: number,
  month: number
): Promise<UserMonthBreakdown> => {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  const pad = (n: number) => String(n).padStart(2, '0');
  const toYmd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const startYmd = toYmd(monthStart);
  const endYmd = toYmd(monthEnd);

  const holidayDates = await loadHolidayDatesInRange(db, startYmd, endYmd);

  const tplRows = await db
    .prepare(
      `SELECT kind, weekday, start_time, end_time FROM service_templates WHERE service_user_id = ? ORDER BY kind, weekday, start_time`
    )
    .bind(serviceUserId)
    .all<ServiceTemplateRow>();

  const templates = tplRows.results;

  let daysLaborable = 0;
  let daysFestivo = 0;
  let daysFinSemana = 0;
  let plannedMinutesFromTemplates = 0;

  for (let day = 1; day <= monthEnd.getUTCDate(); day += 1) {
    const d = new Date(Date.UTC(year, month - 1, day));
    const ymd = toYmd(d);
    const weekday = d.getUTCDay();
    const kind = classifyDay(ymd, weekday, holidayDates);
    if (kind === 'laborable') daysLaborable += 1;
    else if (kind === 'festivo') daysFestivo += 1;
    else daysFinSemana += 1;

    const applicable = templatesApplicableForDay(templates, kind, weekday);
    for (const t of applicable) {
      plannedMinutesFromTemplates += slotDurationMinutes(t.start_time, t.end_time);
    }
  }

  const assignRows = await db
    .prepare(
      `SELECT planned_start, planned_end FROM assignments
       WHERE service_user_id = ? AND date >= ? AND date <= ? AND status != 'cancelled'`
    )
    .bind(serviceUserId, startYmd, endYmd)
    .all<{ planned_start: string; planned_end: string }>();

  let plannedMinutesFromAssignments = 0;
  for (const a of assignRows.results) {
    plannedMinutesFromAssignments += slotDurationMinutes(a.planned_start, a.planned_end);
  }

  return {
    year,
    month,
    startYmd,
    endYmd,
    daysLaborable,
    daysFestivo,
    daysFinSemana,
    plannedMinutesFromTemplates,
    plannedMinutesFromAssignments
  };
};

export const computeWorkerMonthAssignedMinutes = async (db: D1Like, workerId: string, year: number, month: number) => {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  const pad = (n: number) => String(n).padStart(2, '0');
  const toYmd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const startYmd = toYmd(monthStart);
  const endYmd = toYmd(monthEnd);

  const rows = await db
    .prepare(
      `SELECT planned_start, planned_end FROM assignments
       WHERE assigned_worker_id = ? AND date >= ? AND date <= ? AND status != 'cancelled'`
    )
    .bind(workerId, startYmd, endYmd)
    .all<{ planned_start: string; planned_end: string }>();

  let minutes = 0;
  for (const a of rows.results) {
    minutes += slotDurationMinutes(a.planned_start, a.planned_end);
  }
  return minutes;
};

export const minutesToHours = (minutes: number) => minutes / 60;

export const formatHours = (hours: number) => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

export type ContractLike = {
  hours_per_week: number;
  hours_per_month: number | null;
  start_date: string;
  end_date: string | null;
};

/** Contrato vigente en un mes natural (fechas YYYY-MM-DD). Si hay varios solapados, gana el de `start_date` más reciente. */
export const pickContractForMonth = (contracts: ContractLike[], year: number, month: number) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const first = `${year}-${pad(month)}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = `${year}-${pad(month)}-${pad(lastDay)}`;
  const sorted = [...contracts].sort((a, b) => (a.start_date < b.start_date ? 1 : a.start_date > b.start_date ? -1 : 0));
  for (const c of sorted) {
    if (c.start_date <= last && (!c.end_date || c.end_date >= first)) return c;
  }
  return null;
};
