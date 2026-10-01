-- EnergyInvest — remove o saque mínimo de R$50.
-- Mantém saldo suficiente, janela de saque, 1 saque por dia, taxa e CashOut.
begin;

create or replace function private.prepare_withdrawal_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.amount <= 0 then
    raise exception 'O valor do saque precisa ser maior que zero.';
  end if;

  if new.fee_amount is null then
    new.fee_amount := round(new.amount * 0.05, 2);
  end if;

  if new.net_amount is null then
    new.net_amount := round(new.amount - new.fee_amount, 2);
  end if;

  if new.net_amount <= 0 then
    raise exception 'Valor líquido do saque inválido.';
  end if;

  return new;
end;
$$;

revoke all on function private.prepare_withdrawal_rules()
from public, anon, authenticated;

commit;
