-- EnergyInvest — limita cada usuário a 1 solicitação de saque por dia
-- Dia considerado no fuso America/Sao_Paulo.
-- A regra vale para qualquer status do saque (pending/completed/cancelled).
begin;

create or replace function private.limit_one_withdrawal_per_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date :=
    (now() at time zone 'America/Sao_Paulo')::date;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(
      'withdrawal:' ||
      new.user_id::text ||
      ':' ||
      v_today::text
    )::bigint
  );

  if exists (
    select 1
    from public.withdrawals w
    where w.user_id = new.user_id
      and (
        w.created_at at time zone 'America/Sao_Paulo'
      )::date = v_today
  ) then
    raise exception
      'Você já solicitou um saque hoje. O limite é de 1 saque por dia.';
  end if;

  return new;
end;
$$;

revoke all
on function private.limit_one_withdrawal_per_day()
from public, anon, authenticated;

drop trigger if exists limit_one_withdrawal_per_day_trigger
on public.withdrawals;

create trigger limit_one_withdrawal_per_day_trigger
before insert
on public.withdrawals
for each row
execute function private.limit_one_withdrawal_per_day();

commit;
