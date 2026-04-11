import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    email: { type: 'string' },
    password: { type: 'string' },
    remote: { type: 'boolean', default: false },
  },
});

const email = values.email;
const password = values.password;

if (!email || !password) {
  console.error("❌ Error: Faltan argumentos.");
  console.log("\nUso correcto:");
  console.log("npm run create:admin -- --email \"tu@email.com\" --password \"TuContraseñaSegura123\" [--remote]\n");
  process.exit(1);
}

const textEncoder = new TextEncoder();
const hashPassword = async (password) => {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 210_000;
  const keyMaterial = await crypto.subtle.importKey('raw', textEncoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
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
  console.log(`Generando hash de contraseña para ${email}...`);
  const admin = await hashPassword(password);
  const adminAccountId = crypto.randomUUID();

  const sql = `
  PRAGMA foreign_keys = ON;
  INSERT INTO accounts
    (id, email, password_hash, password_salt, password_iterations, role, worker_id, active)
  VALUES
    ('${adminAccountId}', '${email}', '${admin.hashBase64}', '${admin.saltBase64}', ${admin.iterations}, 'ADMIN', NULL, 1);
  `;

  const targetFlag = values.remote ? '--remote' : '--local';
  console.log(`\nInsertando administrador en base de datos ${values.remote ? 'REMOTA (PRODUCCIÓN)' : 'LOCAL'}...`);
  
  try {
    execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', targetFlag, '--yes', '--command', sql], { stdio: 'inherit' });
    console.log(`\n✅ Administrador creado con éxito.`);
    console.log(`Email: ${email}`);
  } catch (e) {
    console.error("\n❌ Error creando administrador:", e.message);
    if (values.remote) {
      console.log("Asegúrate de estar logueado en Cloudflare ejecutando: npx wrangler login");
    }
  }
};

run().catch(console.error);