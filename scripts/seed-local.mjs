import { execFileSync } from 'node:child_process';

const textEncoder = new TextEncoder();

const hashPassword = async (password) => {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 210_000;

  const keyMaterial = await crypto.subtle.importKey('raw', textEncoder.encode(password), { name: 'PBKDF2' }, false, [
    'deriveBits'
  ]);

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    keyMaterial,
    256
  );

  const hashBytes = new Uint8Array(derivedBits);
  return {
    hashBase64: btoa(String.fromCharCode(...hashBytes)),
    saltBase64: btoa(String.fromCharCode(...saltBytes)),
    iterations
  };
};

const run = async () => {
  const adminEmail = process.env.SAD_ADMIN_EMAIL ?? 'admin@sad.local';
  const adminPassword = process.env.SAD_ADMIN_PASSWORD ?? 'Admin1234!';

  const workerEmail = process.env.SAD_WORKER_EMAIL ?? 'worker1@sad.local';
  const workerPassword = process.env.SAD_WORKER_PASSWORD ?? 'Worker1234!';

  const admin = await hashPassword(adminPassword);
  const worker = await hashPassword(workerPassword);

  const workerId = crypto.randomUUID();
  const adminAccountId = crypto.randomUUID();
  const workerAccountId = crypto.randomUUID();

  const sql = `
PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO workers (id, name, active, worker_type)
VALUES ('${workerId}', 'Trabajadora 1', 1, 'laborable');

INSERT OR IGNORE INTO accounts
  (id, email, password_hash, password_salt, password_iterations, role, worker_id, active)
VALUES
  ('${adminAccountId}', '${adminEmail}', '${admin.hashBase64}', '${admin.saltBase64}', ${admin.iterations}, 'ADMIN', NULL, 1);

INSERT OR IGNORE INTO accounts
  (id, email, password_hash, password_salt, password_iterations, role, worker_id, active)
VALUES
  ('${workerAccountId}', '${workerEmail}', '${worker.hashBase64}', '${worker.saltBase64}', ${worker.iterations}, 'WORKER', '${workerId}', 1);
`;

  execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', '--yes', '--command', sql], { stdio: 'inherit' });

  // eslint-disable-next-line no-console
  console.log('\nSeed completado (local):');
  // eslint-disable-next-line no-console
  console.log(`- ADMIN  ${adminEmail} / ${adminPassword}`);
  // eslint-disable-next-line no-console
  console.log(`- WORKER ${workerEmail} / ${workerPassword}\n`);
};

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

