import type { APIContext } from 'astro';
import { db } from '../../../lib/db';
import { getSessionAccount } from '../../../lib/auth';
import { getWorkerAssignmentsVersion } from '../../../lib/realtime';

export const prerender = false;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(context: APIContext) {
  // Protegido por sesión (y además validamos rol aquí).
  const database = db();

  const account = await getSessionAccount(context);
  if (!account) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
  if (account.role !== 'WORKER' || !account.workerId) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  }

  const url = new URL(context.request.url);
  const sinceRaw = url.searchParams.get('since');
  const since = sinceRaw === null ? null : Number(sinceRaw);
  const sinceVersion = Number.isFinite(since) ? (since as number) : null;

  // Long-polling: espera hasta 25s a que cambie la versión.
  const started = Date.now();
  const timeoutMs = 25_000;
  const pollEveryMs = 1_000;

  let version = await getWorkerAssignmentsVersion(database, account.workerId);
  while (sinceVersion !== null && version <= sinceVersion && Date.now() - started < timeoutMs) {
    await sleep(pollEveryMs);
    version = await getWorkerAssignmentsVersion(database, account.workerId);
  }

  return new Response(JSON.stringify({ version }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Evita caches intermedias: queremos frescura.
      'cache-control': 'no-store',
    },
  });
}
