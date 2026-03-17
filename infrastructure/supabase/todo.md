# /infrastructure/supabase

Purpose
Central supabase client factory & migration helpers for server-only usage.

Tasks
- [ ] Implement `supabaseAdmin` factory (server-only, service role key) at /lib/supabaseAdmin.ts
- [ ] Add helper wrappers: insertRow, upsertRow, rpcCall (typed)
- [ ] Provide migrations folder structure and doc how to run (supabase cli)
- [ ] Add hydration.md explaining secrets/role usage and safety rules

Constraints
- Never expose service role key to client.
- Agents must call through server actions that use supabaseAdmin.