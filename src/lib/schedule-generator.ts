import { randomId } from './crypto';

const holidayScopes = ['national', 'catalonia', 'barcelona', 'mataro'] as const;

export const timeToMinutes = (hhmm: string) => {
  const [hRaw, mRaw] = hhmm.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

export const getDayKind = async (database: any, dateYmd: string, weekday0to6: number) => {
  const isWeekend = weekday0to6 === 0 || weekday0to6 === 6;
  const holiday = await database
    .prepare(`SELECT 1 FROM holidays WHERE date = ? AND scope IN (${holidayScopes.map(() => '?').join(',')}) LIMIT 1`)
    .bind(dateYmd, ...holidayScopes)
    .first();
  if (holiday) return 'festivo' as const;
  if (isWeekend) return 'fin_semana' as const;
  return 'laborable' as const;
};

export const matchesWorkerType = (required: string | null, workerType: 'laborable' | 'festivo' | 'ambos') => {
  const req = required ?? 'ambos';
  if (req === 'ambos') return true;
  if (workerType === 'ambos') return true;
  return workerType === req;
};

export const autoAssignWeekRange = async (database: any, startYmd: string, endYmd: string) => {
  const workers = await database
    .prepare(`SELECT id, name, worker_type FROM workers WHERE active = 1 ORDER BY name ASC`)
    .all<{ id: string; name: string; worker_type: 'laborable' | 'festivo' | 'ambos' }>();
  if (workers.results.length === 0) return;

  const weekAssignments = await database
    .prepare(
      `SELECT a.id, a.date, a.kind, a.planned_start, a.planned_end, a.service_user_id, a.assigned_worker_id,
              t.required_worker_type, t.preferred_worker_id
       FROM assignments a
       LEFT JOIN service_templates t ON t.id = a.template_id
       WHERE a.date >= ? AND a.date <= ? AND a.status != 'cancelled'
       ORDER BY a.date ASC, a.planned_start ASC, a.id ASC`
    )
    .bind(startYmd, endYmd)
    .all<{
      id: string;
      date: string;
      kind: string;
      planned_start: string;
      planned_end: string;
      service_user_id: string;
      assigned_worker_id: string | null;
      required_worker_type: string | null;
      preferred_worker_id: string | null;
    }>();

  const workerIntervalsByDate = new Map<string, { start: number; end: number }[]>();
  const workerLoadMinutes = new Map<string, number>();
  for (const a of weekAssignments.results) {
    if (!a.assigned_worker_id) continue;
    const start = timeToMinutes(a.planned_start);
    const end = timeToMinutes(a.planned_end);
    if (start === null || end === null) continue;
    const key = `${a.assigned_worker_id}|${a.date}`;
    const arr = workerIntervalsByDate.get(key) ?? [];
    arr.push({ start, end });
    workerIntervalsByDate.set(key, arr);
    workerLoadMinutes.set(a.assigned_worker_id, (workerLoadMinutes.get(a.assigned_worker_id) ?? 0) + Math.max(0, end - start));
  }

  for (const a of weekAssignments.results.filter((x) => !x.assigned_worker_id)) {
    const start = timeToMinutes(a.planned_start);
    const end = timeToMinutes(a.planned_end);
    if (start === null || end === null) continue;

    const habitualWorkerId = a.preferred_worker_id ?? null;

    const candidates = workers.results
      .map((w) => {
        const key = `${w.id}|${a.date}`;
        const intervals = workerIntervalsByDate.get(key) ?? [];
        const available = !intervals.some((it) => overlaps(start, end, it.start, it.end));
        const compatible = matchesWorkerType(a.required_worker_type, w.worker_type);
        const habitual = habitualWorkerId === w.id;
        const loadMinutes = workerLoadMinutes.get(w.id) ?? 0;
        return { w, available, compatible, habitual, loadMinutes };
      })
      .sort((x, y) =>
        Number(y.compatible) - Number(x.compatible) ||
        Number(y.available) - Number(x.available) ||
        Number(y.habitual) - Number(x.habitual) ||
        x.loadMinutes - y.loadMinutes ||
        x.w.name.localeCompare(y.w.name)
      );

    const pick = candidates.find((c) => c.compatible && c.available)
      ?? candidates.find((c) => c.available)
      ?? candidates.find((c) => c.compatible)
      ?? candidates[0];
    if (!pick) continue;

    await database.prepare(`UPDATE assignments SET assigned_worker_id = ? WHERE id = ?`).bind(pick.w.id, a.id).run();
    const key = `${pick.w.id}|${a.date}`;
    const arr = workerIntervalsByDate.get(key) ?? [];
    arr.push({ start, end });
    workerIntervalsByDate.set(key, arr);
    workerLoadMinutes.set(pick.w.id, (workerLoadMinutes.get(pick.w.id) ?? 0) + Math.max(0, end - start));
  }
};

export const generateWeek = async (database: any, dates: {d: Date, ymd: string}[], regenerate: boolean) => {
  if (regenerate) {
    await database
      .prepare(`DELETE FROM assignments WHERE source = 'template' AND status != 'done' AND date >= ? AND date <= ?`)
      .bind(dates[0].ymd, dates[dates.length - 1].ymd)
      .run();
  }

  const users = await database
    .prepare(`SELECT id, name FROM service_users WHERE active = 1 ORDER BY created_at ASC`)
    .all<{ id: string; name: string }>();

  const templates = await database
    .prepare(
      `SELECT id, service_user_id, kind, weekday, start_time, end_time
       FROM service_templates
       ORDER BY service_user_id ASC, kind ASC, weekday ASC, start_time ASC`
    )
    .all<{ id: string; service_user_id: string; kind: 'laborable' | 'festivo'; weekday: number | null; start_time: string; end_time: string }>();

  const byUser = new Map<string, (typeof templates.results)[number][]>();
  for (const t of templates.results) {
    const arr = byUser.get(t.service_user_id) ?? [];
    arr.push(t);
    byUser.set(t.service_user_id, arr);
  }

  for (const u of users.results) {
    const userTemplates = byUser.get(u.id) ?? [];
    if (userTemplates.length === 0) continue;

    for (const { d, ymd } of dates) {
      const weekday = d.getUTCDay(); // 0..6
      const kind = await getDayKind(database, ymd, weekday);

      const applicable = userTemplates.filter((t) => {
        if (kind === 'laborable') {
          if (t.kind !== 'laborable') return false;
          if (t.weekday === null) return true;
          return t.weekday === weekday;
        }
        // festivo o fin_semana
        if (t.kind !== 'festivo') return false;
        if (t.weekday === null) return true;
        return t.weekday === weekday;
      });

      for (const t of applicable) {
        await database
          .prepare(
            `INSERT INTO assignments
              (id, date, service_user_id, template_id, kind, planned_start, planned_end, source)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'template')
             ON CONFLICT(service_user_id, date, template_id) DO UPDATE SET
               kind = excluded.kind,
               planned_start = excluded.planned_start,
               planned_end = excluded.planned_end,
               status = 'planned',
               source = 'template'`
          )
          .bind(randomId(), ymd, u.id, t.id, kind === 'fin_semana' ? 'fin_semana' : t.kind, t.start_time, t.end_time)
          .run();
      }
    }
  }

  await autoAssignWeekRange(database, dates[0].ymd, dates[dates.length - 1].ymd);
};