import { randomId } from './crypto';

type WorkerNotificationInput = {
  title: string;
  body: string;
  url?: string;
  category?: string;
};

export const createWorkerNotifications = async (
  database: D1Database,
  workerIds: string[],
  notification: WorkerNotificationInput
) => {
  const uniq = Array.from(new Set(workerIds.filter(Boolean)));
  if (uniq.length === 0) return;

  const category = String(notification.category ?? 'general').trim() || 'general';
  const title = String(notification.title ?? '').trim();
  const body = String(notification.body ?? '').trim();
  const url = String(notification.url ?? '').trim();
  if (!title || !body) return;

  for (const workerId of uniq) {
    await database
      .prepare(
        `INSERT INTO worker_notifications (id, worker_id, category, title, body, url)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(randomId(), workerId, category, title, body, url || null)
      .run();
  }
};

export const getWorkerUnreadNotificationsCount = async (database: D1Database, workerId: string) => {
  const row = await database
    .prepare(
      `SELECT COUNT(*) as count
       FROM worker_notifications
       WHERE worker_id = ? AND read_at IS NULL`
    )
    .bind(workerId)
    .first<{ count: number }>();
  return row?.count ?? 0;
};
