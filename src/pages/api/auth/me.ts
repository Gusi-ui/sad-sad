import type { APIRoute } from 'astro';
import { getSessionAccount } from '../../../lib/auth';

export const GET: APIRoute = async (context) => {
  const account = await getSessionAccount(context);
  if (!account) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }

  return new Response(JSON.stringify({ authenticated: true, account }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
};

