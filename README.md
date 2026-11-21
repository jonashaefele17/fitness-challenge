# Fitness Challenge

A PWA for a small group of friends to train together, make progress visible and keep each other motivated.

- Product concept (German): [docs/konzept.md](docs/konzept.md)
- Project rules (German): [CLAUDE.md](CLAUDE.md)
- Setup and operations (German): [docs/einrichtung.md](docs/einrichtung.md)

## Stack

React 19 + TypeScript (strict) + Vite, vite-plugin-pwa · Tailwind CSS v4 with design tokens · Radix primitives · Motion · TanStack Query · React Router · Supabase (Postgres, Auth, RLS) · Vitest + pgTAP · GitHub Pages via GitHub Actions.

## Getting started

Requires Node 22+ and Docker.

```sh
npm install
npm run db:start            # local Supabase (migrations + supabase/seed.sql)
cp .env.example .env.local  # fill in the publishable key printed by db:start
npm run dev                 # http://localhost:5173
```

Local invite codes: `DEV-ADMIN`, `DEV-INVITE`, `DEV-OTHER`. In development the login screen offers an email one-time-code login; mails land in Mailpit (http://127.0.0.1:54324).

## Scripts

| Script | Purpose |
| --- | --- |
| `dev` / `build` / `preview` | Vite |
| `lint` / `typecheck` / `test` | ESLint, `tsc`, Vitest (run all three before committing) |
| `test:rls` | pgTAP row-level-security tests against the local database |
| `format` / `format:check` | Prettier |
| `db:start` / `db:stop` / `db:reset` | Local Supabase stack |
| `db:types` | Regenerate `src/shared/types/database.ts` (CI fails if outdated) |
| `invite -- new` / `invite -- bootstrap` | Generate invite codes (only hashes are stored) |
| `icons` | Regenerate PWA icons from `public/favicon.svg` |

## Structure

```
src/
  app/              shell, providers, router, routes (thin composition of features)
  features/<name>/  api/ (TanStack Query hooks, the only place that talks to Supabase),
                    components/, types.ts, index.ts (public interface)
  shared/           ui/, design-tokens/, lib/, types/ (no feature code)
supabase/
  migrations/       schema, RLS policies, RPCs — the only way the database changes
  tests/            pgTAP RLS tests
  seed.sql          local-only fixtures
scripts/            invite codes, database export, Vitest wrapper
.github/workflows/  ci, deploy-staging, db-export
```

ESLint enforces two architecture rules: features are imported only through their `index.ts`, and only `shared/lib/supabase.ts` and `features/*/api` may import Supabase.

## Multi-group data model

Groups are tenants (`groups`, `group_members` n:m with role `admin | member`). Invites belong to a group and are stored as SHA-256 hashes. Every policy checks membership through helpers in the `private` schema (`is_group_member`, `is_group_admin`, `shares_group_with`, `is_super_admin`). Group-scoped tables get a `group_id`; personal data belongs to the person; catalogue data is global. In the frontend, `useActiveGroup()` provides the group id for all group-scoped queries, and `groupKeys.scope(groupId)` prefixes their query keys.

## Deployment

- `ci.yml`: format, lint, typecheck, unit tests, build; migrations + RLS tests + generated-types check on a fresh database.
- `deploy-staging.yml`: on push to `main` (or manual run): `supabase db push` to staging, build with base path `/fitness-challenge/`, publish to GitHub Pages.
- `db-export.yml`: weekly encrypted dump of staging and live as workflow artifacts.

## Credits

- Training type icons (barbell, run, bike, football, table tennis, yoga) from [Tabler Icons](https://tabler.io/icons), MIT License, © Paweł Kuna.
