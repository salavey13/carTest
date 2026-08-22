create table if not exists public.doc_verifier_records (
  id uuid primary key default gen_random_uuid(),
  integration_scope text not null default 'core',
  document_key text not null,
  source_file_name text not null,
  original_storage_path text not null,
  original_sha256 text not null,
  uploaded_by text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists doc_verifier_records_scope_key_uidx
  on public.doc_verifier_records (integration_scope, document_key);

create index if not exists doc_verifier_records_created_at_idx
  on public.doc_verifier_records (created_at desc);
