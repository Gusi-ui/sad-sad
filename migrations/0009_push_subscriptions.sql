-- Suscripciones Web Push por trabajadora.
-- Guardamos endpoint + claves, y eliminamos cuando expiran (410 Gone).

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_uq ON push_subscriptions(endpoint);
CREATE INDEX IF NOT EXISTS push_subscriptions_worker_idx ON push_subscriptions(worker_id);

