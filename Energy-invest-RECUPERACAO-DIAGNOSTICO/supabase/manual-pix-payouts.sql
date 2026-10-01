-- EnergyInvest — PIX manual avulso no Admin.
-- O envio real é feito pelo backend usando POST /pix/cashOut da PushinPay.
begin;

create table if not exists public.manual_pix_payouts (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null,
  amount numeric(18,2) not null check (amount > 0),
  pix_key_type text not null
    check (pix_key_type in ('cpf','email','phone','random')),
  pix_key text not null,
  status text not null default 'sending',
  provider_status text,
  cashout_id text,
  end_to_end_id text,
  receiver_name text,
  error text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists manual_pix_payouts_cashout_id_unique
on public.manual_pix_payouts(cashout_id)
where cashout_id is not null;

create index if not exists manual_pix_payouts_created_at_idx
on public.manual_pix_payouts(created_at desc);

alter table public.manual_pix_payouts enable row level security;

revoke all on table public.manual_pix_payouts
from public, anon, authenticated;

grant all on table public.manual_pix_payouts
to service_role;

commit;
