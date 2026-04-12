import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { getSessionAccount } from '../../../lib/auth';
import { sendPushToWorkerIds } from '../../../lib/push';

export const POST: APIRoute = async (context) => {
  const account = await getSessionAccount(context);
  if (!account) return new Response('Unauthorized', { status: 401 });
  if (account.role !== 'WORKER' || !account.workerId) return new Response('Forbidden', { status: 403 });

  const result = await sendPushToWorkerIds(db(), [account.workerId], {
    title: 'Notificación de prueba',
    body: 'Si ves esto, el push real está funcionando.',
    url: '/w/planning'
  });

  return new Response(JSON.stringify({ ok: true, result }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
};

