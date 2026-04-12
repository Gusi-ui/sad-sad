-- Versionado por trabajadora para avisos selectivos.

CREATE TABLE IF NOT EXISTS realtime_worker_versions (
  worker_id TEXT PRIMARY KEY,
  assignments_version INTEGER NOT NULL
);

