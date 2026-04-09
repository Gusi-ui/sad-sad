PRAGMA foreign_keys = ON;

-- Usuarios del servicio (beneficiarios)
CREATE TABLE IF NOT EXISTS service_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Contratos semanales por trabajadora (históricos por vigencia)
CREATE TABLE IF NOT EXISTS worker_contracts (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  hours_per_week REAL NOT NULL,
  start_date TEXT NOT NULL, -- YYYY-MM-DD
  end_date TEXT, -- YYYY-MM-DD
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(worker_id) REFERENCES workers(id)
);
CREATE INDEX IF NOT EXISTS idx_worker_contracts_worker_id ON worker_contracts(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_contracts_dates ON worker_contracts(worker_id, start_date, end_date);

-- Festivos (MVP: manual por admin)
CREATE TABLE IF NOT EXISTS holidays (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL, -- YYYY-MM-DD
  name TEXT NOT NULL,
  scope TEXT NOT NULL, -- national|catalonia|barcelona|mataro
  year INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_holidays_date_scope ON holidays(date, scope);
CREATE INDEX IF NOT EXISTS idx_holidays_year ON holidays(year);

-- Plantillas de servicio por usuario
CREATE TABLE IF NOT EXISTS service_templates (
  id TEXT PRIMARY KEY,
  service_user_id TEXT NOT NULL,
  kind TEXT NOT NULL, -- laborable|festivo
  weekday INTEGER, -- 0..6 (solo cuando kind=laborable o cuando aplique)
  start_time TEXT NOT NULL, -- HH:MM
  end_time TEXT NOT NULL, -- HH:MM
  required_worker_type TEXT NOT NULL DEFAULT 'laborable', -- laborable|festivo|ambos
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(service_user_id) REFERENCES service_users(id)
);
CREATE INDEX IF NOT EXISTS idx_templates_user ON service_templates(service_user_id);
CREATE INDEX IF NOT EXISTS idx_templates_lookup ON service_templates(service_user_id, kind, weekday);

-- Asignaciones (agenda planificada)
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL, -- YYYY-MM-DD
  service_user_id TEXT NOT NULL,
  template_id TEXT,
  kind TEXT NOT NULL, -- laborable|festivo|fin_semana
  planned_start TEXT NOT NULL, -- HH:MM
  planned_end TEXT NOT NULL, -- HH:MM
  assigned_worker_id TEXT,
  status TEXT NOT NULL DEFAULT 'planned', -- planned|cancelled|done
  source TEXT NOT NULL DEFAULT 'template', -- template|manual|substitution
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(service_user_id) REFERENCES service_users(id),
  FOREIGN KEY(template_id) REFERENCES service_templates(id),
  FOREIGN KEY(assigned_worker_id) REFERENCES workers(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assignments_unique ON assignments(service_user_id, date, template_id);
CREATE INDEX IF NOT EXISTS idx_assignments_date ON assignments(date);
CREATE INDEX IF NOT EXISTS idx_assignments_worker_date ON assignments(assigned_worker_id, date);

