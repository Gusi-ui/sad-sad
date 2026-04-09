import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { randomId, verifyPassword } from './crypto';

const SESSION_COOKIE_NAME = 'sad_session';

type DbAccountRow = {
  id: string;
  role: 'ADMIN' | 'WORKER';
  worker_id: string | null;
  email: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  active: number;
};

const getDb = () => env.DB;

export const getSessionAccount = async (context: APIContext) => {
  const sessionId = context.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
  if (!sessionId) return null;

  const db = getDb();
  const sessionRow = await db
    .prepare(
      `
      SELECT s.id as session_id, s.expires_at, s.revoked_at,
             a.id as account_id, a.role, a.worker_id, a.email, a.active
      FROM sessions s
      JOIN accounts a ON a.id = s.account_id
      WHERE s.id = ?
      LIMIT 1
    `
    )
    .bind(sessionId)
    .first<{
      session_id: string;
      expires_at: string;
      revoked_at: string | null;
      account_id: string;
      role: 'ADMIN' | 'WORKER';
      worker_id: string | null;
      email: string;
      active: number;
    }>();

  if (!sessionRow) return null;
  if (sessionRow.revoked_at) return null;

  const nowIso = new Date().toISOString();
  if (sessionRow.expires_at <= nowIso) return null;
  if (sessionRow.active !== 1) return null;

  return {
    id: sessionRow.account_id,
    role: sessionRow.role,
    workerId: sessionRow.worker_id,
    email: sessionRow.email
  };
};

export const setSessionCookie = (context: APIContext, sessionId: string, expiresAt: Date) => {
  context.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.env.DEV,
    path: '/',
    expires: expiresAt
  });
};

export const clearSessionCookie = (context: APIContext) => {
  context.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
};

export const loginWithEmailPassword = async (context: APIContext, emailRaw: string, password: string) => {
  const email = emailRaw.trim().toLowerCase();
  if (!email || !password) return { ok: false as const, reason: 'missing' as const };

  const db = getDb();
  const account = await db
    .prepare(
      `
      SELECT id, role, worker_id, email,
             password_hash, password_salt, password_iterations, active
      FROM accounts
      WHERE email = ?
      LIMIT 1
    `
    )
    .bind(email)
    .first<DbAccountRow>();

  if (!account) return { ok: false as const, reason: 'invalid' as const };
  if (account.active !== 1) return { ok: false as const, reason: 'inactive' as const };

  const passwordOk = await verifyPassword(password, {
    hashBase64: account.password_hash,
    saltBase64: account.password_salt,
    iterations: account.password_iterations
  });
  if (!passwordOk) return { ok: false as const, reason: 'invalid' as const };

  const sessionId = randomId();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

  await db
    .prepare(`INSERT INTO sessions (id, account_id, expires_at) VALUES (?, ?, ?)`)
    .bind(sessionId, account.id, expiresAt.toISOString())
    .run();

  setSessionCookie(context, sessionId, expiresAt);

  return {
    ok: true as const,
    account: { id: account.id, role: account.role, workerId: account.worker_id, email: account.email }
  };
};

export const logout = async (context: APIContext) => {
  const sessionId = context.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
  clearSessionCookie(context);
  if (!sessionId) return;

  const db = getDb();
  await db.prepare(`UPDATE sessions SET revoked_at = datetime('now') WHERE id = ?`).bind(sessionId).run();
};

