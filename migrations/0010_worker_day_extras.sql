-- Extras por día para trabajadoras (desplazamiento, etc.)

CREATE TABLE IF NOT EXISTS worker_day_extras (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD
  travel_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(worker_id) REFERENCES workers(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_worker_day_extras_worker_date ON worker_day_extras(worker_id, date);
CREATE INDEX IF NOT EXISTS idx_worker_day_extras_date ON worker_day_extras(date);

