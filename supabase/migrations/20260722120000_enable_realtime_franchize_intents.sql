-- Enable Realtime on franchize_intents for the lead-watcher daemon.
-- Таблица создана миграцией 20260508120000_create_franchize_intents.sql
-- (RLS включена, anon/authenticated revoked, service_role granted).
--
-- Подписчик (src/lead-watcher.ts в vip-bike-боте) ходит с service_role key —
-- RLS обходится, отдельные SELECT-политики не нужны.
--
-- Идемпотентно: безопасно запускать повторно.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'franchize_intents'
  ) then
    alter publication supabase_realtime add table public.franchize_intents;
  end if;
end $$;
