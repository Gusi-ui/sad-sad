import { env } from 'cloudflare:workers';
import { buildPushHTTPRequest } from '@pushforge/builder';
import { randomId } from './crypto';
import { createWorkerNotifications } from './worker-notifications';

type StoredSub = {
  id: string;
  worker_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

const getVapidPublicKey = () => (env as any).VAPID_PUBLIC_KEY as string | undefined;
const getVapidPrivateJwk = () => (env as any).VAPID_PRIVATE_KEY as string | undefined;
const getVapidSubject = () => ((env as any).VAPID_SUBJECT as string | undefined) ?? 'mailto:admin@example.com';

export const requireVapidPublicKey = () => {
  const k = getVapidPublicKey();
  if (!k) throw new Error('VAPID_PUBLIC_KEY not configured');
  return k;
};

export const isPushConfigured = () => Boolean(getVapidPublicKey() && getVapidPrivateJwk());

export const upsertWorkerSubscription = async (
  database: D1Database,
  workerId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
) => {
  const endpoint = String(subscription.endpoint ?? '').trim();
  const p256dh = String(subscription.keys?.p256dh ?? '').trim();
  const auth = String(subscription.keys?.auth ?? '').trim();
  if (!endpoint || !p256dh || !auth) throw new Error('invalid_subscription');

  const existing = await database
    .prepare(`SELECT id, worker_id FROM push_subscriptions WHERE endpoint = ? LIMIT 1`)
    .bind(endpoint)
    .first<{ id: string; worker_id: string }>();

  const id = existing?.id ?? randomId();
  await database
    .prepare(
      `INSERT INTO push_subscriptions (id, worker_id, endpoint, p256dh, auth)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         worker_id = excluded.worker_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         updated_at = datetime('now')`
    )
    .bind(id, workerId, endpoint, p256dh, auth)
    .run();

  return { id };
};

export const deleteSubscriptionByEndpoint = async (database: D1Database, endpoint: string) => {
  await database.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).bind(endpoint).run();
};

const safeParsePrivateJwk = () => {
  const raw = getVapidPrivateJwk();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // Permitimos también que se guarde como string ya “JWK” en algunos entornos.
    return raw as any;
  }
};

export const sendPushToWorkerIds = async (
  database: D1Database,
  workerIds: string[],
  message: { title: string; body: string; url?: string }
) => {
  const uniq = Array.from(new Set(workerIds.filter(Boolean)));
  if (uniq.length === 0) return { ok: true as const, sent: 0 };

  // Siempre guardamos el aviso en la mensajería interna, aunque el push no esté configurado.
  await createWorkerNotifications(database, uniq, {
    category: 'planning',
    title: message.title,
    body: message.body,
    url: message.url ?? '/w/planning',
  });

  if (!isPushConfigured()) return { ok: false as const, reason: 'not_configured' as const };

  const privateJWK = safeParsePrivateJwk();
  if (!privateJWK) return { ok: false as const, reason: 'not_configured' as const };

  const adminContact = getVapidSubject();

  // D1 no soporta bind de arrays directamente de forma portable, así que generamos placeholders.
  const placeholders = uniq.map(() => '?').join(',');
  const subs = await database
    .prepare(
      `SELECT id, worker_id, endpoint, p256dh, auth
       FROM push_subscriptions
       WHERE worker_id IN (${placeholders})`
    )
    .bind(...uniq)
    .all<StoredSub>();

  let sent = 0;
  for (const s of subs.results) {
    try {
      const subscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth }
      };

      const { endpoint, headers, body } = await buildPushHTTPRequest({
        privateJWK,
        subscription,
        message: {
          payload: {
            title: message.title,
            body: message.body,
            url: message.url ?? '/w/planning'
          },
          adminContact
        }
      });

      const res = await fetch(endpoint, { method: 'POST', headers, body });
      if (res.status === 404 || res.status === 410) {
        // Suscripción expirada: limpiar
        await database.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).bind(s.id).run();
      } else if (res.ok) {
        sent += 1;
      }
    } catch {
      // No rompemos el envío por un fallo puntual.
    }
  }

  return { ok: true as const, sent };
};
