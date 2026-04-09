# Contribuir

## Reglas obligatorias

- **Nada de errores ni warnings**: los PRs deben pasar `npm run check`.
- **TypeScript estricto**: no se aceptan `any` implícitos ni tipos flojos.
- **Seguridad**: no subir secretos. Usa `.dev.vars` (no se commitea). Ejemplo en `.dev.vars.example`.
- **DB**: toda modificación del esquema va como **migración D1** en `migrations/` (nunca a mano en producción).
- **Accesibilidad**: formularios con `label`, inputs con estados focus y semántica.

## Flujo de trabajo

1. `npm ci`
2. `npm run db:migrate:local`
3. `npm run seed:local`
4. `npm run dev`
5. Antes de abrir PR: `npm run check`

