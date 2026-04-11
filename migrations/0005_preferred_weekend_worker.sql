PRAGMA foreign_keys = ON;

-- Añadimos la columna para la trabajadora preferida de fines de semana/festivos
ALTER TABLE service_users ADD COLUMN preferred_weekend_worker_id TEXT REFERENCES workers(id);