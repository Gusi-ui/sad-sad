const KEY_ASSIGNMENTS = 'assignments';

export const getAssignmentsVersion = async (database: D1Database) => {
  const row = await database
    .prepare(`SELECT version FROM realtime_state WHERE key = ? LIMIT 1`)
    .bind(KEY_ASSIGNMENTS)
    .first<{ version: number }>();

  return row?.version ?? 0;
};

export const bumpAssignmentsVersion = async (database: D1Database) => {
  // Asegura existencia de la fila (por si no se han aplicado migraciones en algún entorno).
  await database
    .prepare(`INSERT OR IGNORE INTO realtime_state (key, version) VALUES (?, 0)`)
    .bind(KEY_ASSIGNMENTS)
    .run();

  await database
    .prepare(`UPDATE realtime_state SET version = version + 1 WHERE key = ?`)
    .bind(KEY_ASSIGNMENTS)
    .run();
};

// --- Versionado “por trabajadora” (para avisar solo a quien le afecta) ---

export const getWorkerAssignmentsVersion = async (database: D1Database, workerId: string) => {
  const row = await database
    .prepare(`SELECT assignments_version as version FROM realtime_worker_versions WHERE worker_id = ? LIMIT 1`)
    .bind(workerId)
    .first<{ version: number }>();
  return row?.version ?? 0;
};

export const bumpWorkerAssignmentsVersion = async (database: D1Database, workerId: string) => {
  if (!workerId) return;
  await database
    .prepare(`INSERT OR IGNORE INTO realtime_worker_versions (worker_id, assignments_version) VALUES (?, 0)`)
    .bind(workerId)
    .run();
  await database
    .prepare(`UPDATE realtime_worker_versions SET assignments_version = assignments_version + 1 WHERE worker_id = ?`)
    .bind(workerId)
    .run();
};

export const bumpManyWorkerAssignmentsVersions = async (database: D1Database, workerIds: string[]) => {
  const uniq = Array.from(new Set(workerIds.filter(Boolean)));
  for (const id of uniq) {
    // secuencial: simple y suficiente para ~100 trabajadoras
    await bumpWorkerAssignmentsVersion(database, id);
  }
};
