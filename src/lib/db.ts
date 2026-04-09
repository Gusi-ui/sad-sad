import { env } from 'cloudflare:workers';

export const db = () => env.DB;

export const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: { 'content-type': 'application/json; charset=utf-8', ...(init?.headers ?? {}) }
  });

