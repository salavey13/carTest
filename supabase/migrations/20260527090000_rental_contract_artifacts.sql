create table if not exists public.rental_contract_artifacts (
  id uuid primary key default gen_random_uuid(),
  contract_key text not null unique,
  requested_bike_id text,
  resolved_bike_id text,
  telegram_chat_id text,
  telegram_message_id bigint,
  renter_full_name text,
  rent_start_date text,
  rent_end_date text,
  doc_verifier_id uuid references public.doc_verifier_records(id),
  original_sha256 text,
  created_at timestamptz not null default now()
);

create index if not exists idx_rental_contract_artifacts_key
  on public.rental_contract_artifacts(contract_key);

create index if not exists idx_rental_contract_artifacts_sha256
  on public.rental_contract_artifacts(original_sha256);
