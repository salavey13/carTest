-- =============================================
-- Secure table for sensitive renter documents
-- (only service_role can read/write)
-- =============================================

create table if not exists public.rental_verification_docs (
  id uuid primary key default gen_random_uuid(),

  -- References to your existing tables
  rental_id uuid not null references public.rentals(rental_id) on delete cascade,
  renter_user_id text not null references public.users(user_id) on delete cascade,

  -- Sensitive data (never exposed publicly)
  driver_license text,
  passport text,

  -- Metadata
  created_at timestamptz default now(),
  expires_at timestamptz,                    -- e.g. agreed_end_date + 7 days

  constraint rental_verification_docs_unique unique (rental_id)  -- one set of docs per rental
);

-- Enable RLS but allow only service_role (your Supabase server client already has it)
alter table public.rental_verification_docs enable row level security;

create policy "service_role_full_access" 
  on public.rental_verification_docs
  for all 
  to service_role 
  using (true);

-- Optional: index for fast lookup by rental
create index if not exists idx_rental_verification_docs_rental_id 
  on public.rental_verification_docs(rental_id);

-- Optional: index for cleanup by expiration
create index if not exists idx_rental_verification_docs_expires_at 
  on public.rental_verification_docs(expires_at);
