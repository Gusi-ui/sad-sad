# Reglas recomendadas (GitHub) — SAD-SAD

Objetivo: **estar muy actualizado** sin romper producción.

## 1) Branch protection (main)

En GitHub → **Settings → Branches → Branch protection rules** (o Rulesets):

- Require a pull request before merging: ✅
- Require approvals: ✅ (mínimo 1)
- Dismiss stale approvals when new commits are pushed: ✅
- Require status checks to pass before merging: ✅
  - Selecciona el check **CI**
- Require branches to be up to date before merging: ✅
- Restrict who can push to matching branches: ✅ (solo maintainers/owners)
- Allow auto-merge: ✅ (Settings → General)

## 2) Dependabot (ya configurado en el repo)

- Updates semanales
- TS 6.x ignorado temporalmente por compatibilidad con `@astrojs/check` (TS ^5)
- Grupos: `tooling`, `tailwind`

## 3) Auto-merge de Dependabot

Workflow: `.github/workflows/dependabot-automerge.yml`

Regla:
- Auto-approve + auto-merge **solo patch/minor**
- Majors quedan para revisión manual

Necesitas tener activado:
- **Allow auto-merge** en Settings → General
- Branch protection en `main` requiriendo el check **CI**

## 4) Deploy a Cloudflare

Workflow: `.github/workflows/deploy-cloudflare.yml`

- Deploy automático en `push` a `main`
- Migraciones D1 remotas: opcional por `workflow_dispatch` con `runMigrations=true`

Secrets necesarios en GitHub Actions:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Recomendación: mantener `VAPID_PRIVATE_KEY` como **secret** en Cloudflare, no en GitHub.

