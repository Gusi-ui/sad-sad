import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { getSessionAccount } from '../../../lib/auth';
import { upsertWorkerSubscription } from '../../../lib/push';

export const POST: APIRoute = async (context) => {
  const account = await getSessionAccount(context);
  if (!account) return new Response('Unauthorized', { status: 401 });
  if (account.role !== 'WORKER' || !account.workerId) return new Response('Forbidden', { status: 403 });

  const body = (await context.request.json().catch(() => null)) as any;
  if (!body) return new Response('Bad Request', { status: 400 });

  try {
    const result = await upsertWorkerSubscription(db(), account.workerId, body);
    return new Response(JSON.stringify({ ok: true, id: result.id }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
};
