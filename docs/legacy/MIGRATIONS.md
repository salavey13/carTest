# MIGRATIONS.md — Supabase migrations, Storage buckets, и примеры SQL

## Supabase Migrations (рекомендация)
Используйте Supabase CLI для миграций (структура `supabase/migrations`):

### Пример SQL миграции (создать rentals)

`sql
-- 001_create_rentals.sql
create table if not exists public.rentals (
  rental_id uuid primary key default gen_random_uuid(),
  user_id text not null,
  owner_id text,
  vehicle_id text,
  status text not null default 'pending',
  payment_status text not null default 'pending',
  requested_start_date timestamptz,
  requested_end_date timestamptz,
  total_cost integer,
  interest_amount integer,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
`

## Storage buckets (пример)

Создать через WebUI

### Минимальные политики для buckets

* `carpix` — public для обложек.
* `rentals` — private, генерируем signed URL на сервере по проверке прав доступа.

## Hooks и миграции вебхуков

* Для invoice-related hooks: добавляйте `metadata` (например `rental_id`, `car_id`) во время создания инвойса — это критично для связки webhook <-> rental.

## Как хранить миграции в репо

Разместите SQL миграции в `supabase/migrations/` и применяйте их в CI при deploy:

* CI job: `supabase db push --project-ref $SUPABASE_PROJECT_REF --service-role-key $SUPABASE_SERVICE_ROLE_KEY`

## Backups

* План: ежедневный экспорт метаданных + еженедельный full dump.
* Test restore procedure: раз в квартал проверять восстановление на staging.