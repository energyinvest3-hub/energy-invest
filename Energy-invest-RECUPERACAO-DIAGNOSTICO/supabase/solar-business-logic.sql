-- EnergyInvest business logic update.
-- Apply after the base schema. The live Supabase project already has this migration applied.
-- "return_multiplier" is a projection ceiling, not a guaranteed return.

alter table public.solar_projects
  add column if not exists return_multiplier numeric(6,2) not null default 1.00
  check (return_multiplier >= 1 and return_multiplier <= 5);

create table if not exists public.project_distributions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.solar_projects(id) on delete cascade,
  amount_per_unit numeric(18,2) not null check(amount_per_unit > 0),
  source_reference text not null,
  distributed_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(project_id, source_reference)
);

-- Real wallet credits should be created from verified distributions, not from the clock alone.
-- Withdrawals can be requested daily from 09:00 to 18:00 America/Sao_Paulo; the requested amount is reserved immediately.
