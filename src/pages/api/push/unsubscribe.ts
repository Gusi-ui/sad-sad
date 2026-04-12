import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { getSessionAccount } from '../../../lib/auth';
import { deleteSubscriptionByEndpoint } from '../../../lib/push';

export const POST: APIRoute = async (context) => {
  const account = await getSessionAccount(context);
  if (!account) return new Response('Unauthorized', { status: 401 });

  const body = (await context.request.json().catch(() => null)) as any;
  const endpoint = String(body?.endpoint ?? '').trim();
  if (!endpoint) return new Response('Bad Request', { status: 400 });

  await deleteSubscriptionByEndpoint(db(), endpoint);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
};
