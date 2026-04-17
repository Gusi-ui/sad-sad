import type { APIRoute } from 'astro';
import { db } from '../../../../lib/db';
import { getSessionAccount } from '../../../../lib/auth';
import { getWorkerUnreadNotificationsCount } from '../../../../lib/worker-notifications';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const account = await getSessionAccount(context);
  if (!account) return new Response('Unauthorized', { status: 401 });
  if (account.role !== 'WORKER' || !account.workerId) return new Response('Forbidden', { status: 403 });

  const count = await getWorkerUnreadNotificationsCount(db(), account.workerId);
  return new Response(JSON.stringify({ unreadCount: count }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
};
