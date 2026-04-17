-- Notificaciones internas para trabajadoras (mensajería in-app).
CREATE TABLE IF NOT EXISTS worker_notifications (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_worker_notifications_worker_created
  ON worker_notifications(worker_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_worker_notifications_worker_read
  ON worker_notifications(worker_id, read_at);
