-- EnergyInvest — saque mínimo R$50 + PushinPay PIX CashOut
-- Preserva a regra já existente: 1 saque por dia.
-- O envio só ocorre após autorização individual do ADMIN.
begin;

alter table public.withdrawals
  add column if not exists fee_amount numeric(18,2),
  add column if not exists net_amount numeric(18,2),
  add column if not exists cashout_id text,
  add column if not exists cashout_status text,
  add column if not exists cashout_value numeric(18,2),
  add column if not exists cashout_end_to_end_id text,
  add column if not exists cashout_requested_at timestamptz,
  add column if not exists cashout_paid_at timestamptz,
  add column if not exists cashout_error text;

create unique index if not exists withdrawals_cashout_id_unique
on public.withdrawals(cashout_id)
where cashout_id is not null;

update public.withdrawals
set
  fee_amount = coalesce(
    fee_amount,
    round(amount * 0.05, 2)
  ),
  net_amount = coalesce(
    net_amount,
    round(
      amount - coalesce(fee_amount, round(amount * 0.05, 2)),
      2
    )
  )
where fee_amount is null
   or net_amount is null;

create or replace function private.prepare_withdrawal_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.amount < 50 then
    raise exception 'O valor mínimo para saque é R$ 50,00.';
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

drop trigger if exists prepare_withdrawal_rules_trigger
on public.withdrawals;

create trigger prepare_withdrawal_rules_trigger
before insert or update of amount
on public.withdrawals
for each row
execute function private.prepare_withdrawal_rules();

create or replace function public.admin_claim_withdrawal_cashout(
  p_withdrawal_id uuid
) returns public.withdrawals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_enabled boolean := false;
  v_row public.withdrawals%rowtype;
begin
  if v_user_id is null or not private.is_admin() then
    raise exception 'Administrator required';
  end if;

  select automatic_processing_enabled
  into v_enabled
  from public.withdrawal_control_settings
  where id = true;

  if coalesce(v_enabled, false) = false then
    raise exception 'Ative o PIX CashOut nas Configurações antes de enviar.';
  end if;

  select *
  into v_row
  from public.withdrawals
  where id = p_withdrawal_id
  for update;

  if not found then
    raise exception 'Saque não encontrado.';
  end if;

  if v_row.status <> 'pending' then
    raise exception 'Este saque não está pendente.';
  end if;

  if v_row.amount < 50 then
    raise exception 'O valor mínimo para saque é R$ 50,00.';
  end if;

  if v_row.cashout_id is not null then
    raise exception 'Este saque já foi enviado para a PushinPay.';
  end if;

  if coalesce(v_row.cashout_status, '') in ('sending','created','paid','review') then
    raise exception 'Este saque já possui um envio em andamento ou precisa de revisão.';
  end if;

  update public.withdrawals
  set
    auto_authorized_at = coalesce(auto_authorized_at, now()),
    auto_authorized_by = coalesce(auto_authorized_by, v_user_id),
    cashout_status = 'sending',
    cashout_requested_at = now(),
    cashout_error = null
  where id = p_withdrawal_id
  returning * into v_row;

  insert into public.admin_audit_logs(
    admin_user_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values(
    v_user_id,
    'authorize_pushinpay_cashout',
    'withdrawal',
    p_withdrawal_id,
    jsonb_build_object(
      'amount', v_row.amount,
      'net_amount', v_row.net_amount,
      'pix_key_type', v_row.pix_key_type
    )
  );

  return v_row;
end;
$$;

revoke all on function public.admin_claim_withdrawal_cashout(uuid)
from public, anon;

grant execute on function public.admin_claim_withdrawal_cashout(uuid)
to authenticated;

create or replace function public.attach_pushinpay_cashout(
  p_withdrawal_id uuid,
  p_cashout_id text,
  p_value_cents bigint,
  p_status text,
  p_end_to_end_id text default null
) returns public.withdrawals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.withdrawals%rowtype;
  v_expected bigint;
begin
  if current_user <> 'service_role' then
    raise exception 'Service role required';
  end if;

  select *
  into v_row
  from public.withdrawals
  where id = p_withdrawal_id
  for update;

  if not found then
    raise exception 'Saque não encontrado.';
  end if;

  v_expected :=
    round(coalesce(v_row.net_amount, v_row.amount) * 100)::bigint;

  if v_expected <> p_value_cents then
    raise exception 'Valor do CashOut não confere com o valor líquido do saque.';
  end if;

  if v_row.cashout_id is not null
     and v_row.cashout_id <> p_cashout_id then
    raise exception 'Saque já vinculado a outro CashOut.';
  end if;

  update public.withdrawals
  set
    cashout_id = p_cashout_id,
    cashout_status = lower(p_status),
    cashout_value = p_value_cents::numeric / 100,
    cashout_end_to_end_id = coalesce(
      p_end_to_end_id,
      cashout_end_to_end_id
    ),
    cashout_error = null
  where id = p_withdrawal_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.attach_pushinpay_cashout(uuid,text,bigint,text,text)
from public, anon, authenticated;

grant execute on function public.attach_pushinpay_cashout(uuid,text,bigint,text,text)
to service_role;

create or replace function public.settle_pushinpay_withdrawal(
  p_cashout_id text,
  p_value_cents bigint,
  p_status text,
  p_end_to_end_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.withdrawals%rowtype;
  v_status text := lower(coalesce(p_status, ''));
  v_expected bigint;
begin
  if current_user <> 'service_role' then
    raise exception 'Service role required';
  end if;

  select *
  into v_row
  from public.withdrawals
  where cashout_id = p_cashout_id
  for update;

  if not found then
    return jsonb_build_object(
      'processed', false,
      'reason', 'withdrawal_not_found'
    );
  end if;

  v_expected :=
    round(coalesce(v_row.cashout_value, v_row.net_amount, v_row.amount) * 100)::bigint;

  if v_expected <> p_value_cents then
    return jsonb_build_object(
      'processed', false,
      'reason', 'value_mismatch',
      'expected_cents', v_expected,
      'received_cents', p_value_cents
    );
  end if;

  update public.withdrawals
  set
    cashout_status = v_status,
    cashout_end_to_end_id = coalesce(
      p_end_to_end_id,
      cashout_end_to_end_id
    )
  where id = v_row.id;

  if v_status = 'paid' then
    if v_row.status = 'completed' then
      return jsonb_build_object(
        'processed', true,
        'reason', 'already_completed'
      );
    end if;

    if v_row.status <> 'pending' then
      return jsonb_build_object(
        'processed', true,
        'reason', 'withdrawal_not_pending'
      );
    end if;

    update public.withdrawals
    set
      status = 'completed',
      cashout_status = 'paid',
      cashout_paid_at = coalesce(cashout_paid_at, now()),
      cashout_error = null
    where id = v_row.id;

    update public.transactions
    set status = 'completed'
    where user_id = v_row.user_id
      and type = 'withdrawal'
      and reference_id = v_row.id
      and status = 'pending';

    update public.wallets
    set total_withdrawn = total_withdrawn + v_row.amount
    where user_id = v_row.user_id;

    insert into public.notifications(
      user_id,
      title,
      message
    )
    values(
      v_row.user_id,
      'Saque enviado',
      'Seu PIX foi enviado e confirmado pela PushinPay.'
    );

    return jsonb_build_object(
      'processed', true,
      'reason', 'paid',
      'withdrawal_id', v_row.id
    );
  end if;

  if v_status in ('canceled','cancelled') then
    if v_row.status = 'cancelled' then
      return jsonb_build_object(
        'processed', true,
        'reason', 'already_cancelled'
      );
    end if;

    if v_row.status <> 'pending' then
      return jsonb_build_object(
        'processed', true,
        'reason', 'withdrawal_not_pending'
      );
    end if;

    update public.withdrawals
    set
      status = 'cancelled',
      cashout_status = 'canceled'
    where id = v_row.id;

    update public.wallets
    set balance = balance + v_row.amount
    where user_id = v_row.user_id;

    update public.transactions
    set status = 'cancelled'
    where user_id = v_row.user_id
      and type = 'withdrawal'
      and reference_id = v_row.id
      and status = 'pending';

    insert into public.notifications(
      user_id,
      title,
      message
    )
    values(
      v_row.user_id,
      'Saque não concluído',
      'A PushinPay cancelou o envio. O valor reservado foi devolvido para sua carteira.'
    );

    return jsonb_build_object(
      'processed', true,
      'reason', 'canceled',
      'withdrawal_id', v_row.id
    );
  end if;

  return jsonb_build_object(
    'processed', true,
    'reason', 'provider_pending',
    'status', v_status
  );
end;
$$;

revoke all on function public.settle_pushinpay_withdrawal(text,bigint,text,text)
from public, anon, authenticated;

grant execute on function public.settle_pushinpay_withdrawal(text,bigint,text,text)
to service_role;

commit;
