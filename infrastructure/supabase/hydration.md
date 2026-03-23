# /infrastructure/supabase/hydration

## Purpose

Server-only Supabase admin access for privileged integrations and automation flows.

## Secrets and role usage

- `NEXT_PUBLIC_SUPABASE_URL` is safe to expose to browser/runtime code.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is for browser-safe reads/writes covered by RLS.
- `SUPABASE_SERVICE_ROLE_KEY` is **server only** and must never cross a `"use client"` boundary.

## New factory contract

- Use `lib/supabaseAdmin.ts` for service-role access.
- Import it only from:
  - route handlers,
  - server actions,
  - server components,
  - Node scripts.
- Prefer helpers:
  - `insertRow(table, values)`
  - `upsertRow(table, values, options)`
  - `rpcCall(name, args)`

## Why this refactor helps future integrations

- removes duplicated `createClient(...service role...)` snippets,
- keeps auth options consistent,
- gives one place to harden logging / retries / telemetry later,
- lowers risk of accidental client-side service-role imports.

## Migrations structure and CLI

This repo keeps SQL migrations in:

- `supabase/migrations/*.sql`
- `supabase/migrations/supaplan/*.sql`

Typical local flow:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

If you need a local reset first:

```bash
supabase db reset
supabase db push
```

## Safety rules

- Never pass the service-role key to browser bundles.
- Never import `lib/supabaseAdmin.ts` inside files marked `"use client"`.
- Keep privileged writes behind explicit server boundaries.
