import type { APIRoute } from 'astro';
import { requireVapidPublicKey } from '../../../lib/push';

export const GET: APIRoute = async () => {
  try {
    const key = requireVapidPublicKey();
    return new Response(JSON.stringify({ publicKey: key }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  } catch {
    return new Response(JSON.stringify({ publicKey: null }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
};

