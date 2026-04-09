# SAD (Ayuda a Domicilio) — Astro + Cloudflare (D1)

MVP para gestionar **agenda**, **asignaciones**, **festivos**, **sustituciones** y **fichajes** en un servicio de ayuda a domicilio.

## Desarrollo local

```bash
npm ci
npm run db:migrate:local
npm run seed:local

# crea .dev.vars desde el ejemplo
cp .dev.vars.example .dev.vars

npm run dev -- --host 127.0.0.1 --port 4321
```

Login (local):
- **ADMIN**: `admin@sad.local` / `Admin1234!`
- **WORKER**: `worker1@sad.local` / `Worker1234!`

## Calidad

- `npm run check` ejecuta **typecheck + build** y debe pasar sin errores.

