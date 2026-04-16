CREATE TABLE IF NOT EXISTS worker_travel_templates (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  weekday INTEGER NOT NULL,
  travel_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(worker_id, weekday),
  FOREIGN KEY(worker_id) REFERENCES workers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_worker_travel_templates_worker_id ON worker_travel_templates(worker_id);
