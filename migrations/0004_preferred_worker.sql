PRAGMA foreign_keys = ON;

-- Añadimos la columna para la trabajadora preferida
ALTER TABLE service_users ADD COLUMN preferred_worker_id TEXT REFERENCES workers(id);
