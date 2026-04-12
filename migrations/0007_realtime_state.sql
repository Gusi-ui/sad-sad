-- Estado simple para “casi tiempo real” vía long-polling.
-- La app incrementa la versión cuando cambian las asignaciones,
-- y las vistas de trabajadoras escuchan cambios con /api/realtime/assignments.

CREATE TABLE IF NOT EXISTS realtime_state (
  key TEXT PRIMARY KEY,
  version INTEGER NOT NULL
);

INSERT OR IGNORE INTO realtime_state (key, version) VALUES ('assignments', 0);

