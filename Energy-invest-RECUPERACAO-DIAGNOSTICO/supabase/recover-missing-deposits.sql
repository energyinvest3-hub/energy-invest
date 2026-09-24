-- ENERGYINVEST - RECUPERAÇÃO DE DEPÓSITOS
-- NÃO altera saldo de carteira.
-- O objetivo é reconstruir SOMENTE o histórico de depósitos concluídos
-- que ainda exista no ledger public.transactions.

-- 1) DIAGNÓSTICO: rode primeiro e confira os resultados.
select
  count(*) as deposits_rows,
  count(*) filter (where status='completed') as deposits_completed,
  coalesce(sum(amount) filter (where status='completed'),0) as deposits_completed_total
from public.deposits;

select
  count(*) as completed_deposit_transactions,
  coalesce(sum(amount),0) as completed_deposit_transactions_total
from public.transactions
where type='deposit'
  and status='completed';

select
  count(*) as missing_deposit_rows,
  coalesce(sum(t.amount),0) as missing_deposit_total
from public.transactions t
left join public.deposits d
  on d.id = t.reference_id
where t.type='deposit'
  and t.status='completed'
  and t.reference_id is not null
  and d.id is null;

-- Mostra exatamente o que seria recuperado.
select
  t.reference_id as deposit_id,
  t.user_id,
  t.amount,
  t.created_at,
  p.name,
  p.email
from public.transactions t
left join public.deposits d
  on d.id = t.reference_id
left join public.profiles p
  on p.id = t.user_id
where t.type='deposit'
  and t.status='completed'
  and t.reference_id is not null
  and d.id is null
order by t.created_at asc;

-- 2) SNAPSHOT DO ESTADO ATUAL ANTES DE QUALQUER RECUPERAÇÃO.
create schema if not exists incident_recovery;

create table if not exists incident_recovery.deposits_before_recovery
as
select * from public.deposits
with no data;

insert into incident_recovery.deposits_before_recovery
select d.*
from public.deposits d
where not exists (
  select 1
  from incident_recovery.deposits_before_recovery b
  where b.id = d.id
);

create table if not exists incident_recovery.transactions_before_recovery
as
select * from public.transactions
with no data;

insert into incident_recovery.transactions_before_recovery
select t.*
from public.transactions t
where not exists (
  select 1
  from incident_recovery.transactions_before_recovery b
  where b.id = t.id
);

-- 3) RECUPERAÇÃO PELO LEDGER.
-- Restaura o registro em deposits, mas NÃO credita carteira novamente.
-- gateway_id/pix_code originais não existem no ledger e ficam nulos.
insert into public.deposits (
  id,
  user_id,
  amount,
  gateway_id,
  status,
  created_at,
  provider,
  pix_code,
  provider_status,
  paid_at,
  updated_at
)
select
  t.reference_id,
  t.user_id,
  t.amount,
  null,
  'completed',
  t.created_at,
  'recovered-ledger',
  null,
  'completed',
  t.created_at,
  now()
from public.transactions t
left join public.deposits d
  on d.id = t.reference_id
where t.type='deposit'
  and t.status='completed'
  and t.reference_id is not null
  and d.id is null
  and t.amount > 0
on conflict (id) do nothing;

-- 4) VERIFICAÇÃO PÓS-RECUPERAÇÃO.
select
  count(*) as deposits_rows,
  count(*) filter (where status='completed') as deposits_completed,
  coalesce(sum(amount) filter (where status='completed'),0) as deposits_completed_total
from public.deposits;

select
  coalesce(sum(total_deposited),0) as wallets_total_deposited
from public.wallets;

select
  coalesce(sum(amount),0) as ledger_completed_deposits
from public.transactions
where type='deposit'
  and status='completed';

-- Se os totais divergirem, NÃO ajuste wallets automaticamente.
-- Compare com backup/PITR e com o histórico da SyncPay.
