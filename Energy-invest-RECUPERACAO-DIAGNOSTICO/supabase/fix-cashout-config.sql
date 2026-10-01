-- EnergyInvest — correção da persistência do PIX CashOut.
-- Também permite pagar saques antigos (< R$50) que foram criados
-- antes da nova regra de saque mínimo.
begin;

insert into public.withdrawal_control_settings(
  id,
  automatic_processing_enabled,
  updated_at
)
values(
  true,
  false,
  now()
)
on conflict (id) do nothing;

create or replace function public.admin_set_automatic_withdrawals(
  p_enabled boolean
) returns public.withdrawal_control_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid :=
    (select auth.uid());

  v_row public.withdrawal_control_settings%rowtype;
begin
  if
    v_user_id is null
    or not private.is_admin()
  then
    raise exception
      'Administrator required';
  end if;

  insert into public.withdrawal_control_settings(
    id,
    automatic_processing_enabled,
    updated_by,
    updated_at
  )
  values(
    true,
    p_enabled,
    v_user_id,
    now()
  )
  on conflict (id)
  do update set
    automatic_processing_enabled =
      excluded.automatic_processing_enabled,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  returning *
  into v_row;

  insert into public.admin_audit_logs(
    admin_user_id,
    action,
    target_type,
    metadata
  )
  values(
    v_user_id,
    'set_automatic_withdrawals',
    'withdrawal_settings',
    jsonb_build_object(
      'enabled',
      p_enabled
    )
  );

  return v_row;
end;
$$;

revoke all
on function public.admin_set_automatic_withdrawals(boolean)
from public, anon;

grant execute
on function public.admin_set_automatic_withdrawals(boolean)
to authenticated;

create or replace function public.service_claim_pushinpay_cashout(
  p_withdrawal_id uuid,
  p_admin_user_id uuid
) returns public.withdrawals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled boolean := false;
  v_row public.withdrawals%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception
      'Service role required';
  end if;

  select
    automatic_processing_enabled
  into v_enabled
  from public.withdrawal_control_settings
  where id = true;

  if coalesce(v_enabled, false) = false then
    raise exception
      'O PIX CashOut está desativado. Ative e salve em Configurações antes de enviar.';
  end if;

  select *
  into v_row
  from public.withdrawals
  where id = p_withdrawal_id
  for update;

  if not found then
    raise exception
      'Saque não encontrado.';
  end if;

  if v_row.status <> 'pending' then
    raise exception
      'Este saque não está pendente.';
  end if;

  if v_row.cashout_id is not null then
    raise exception
      'Este saque já foi enviado para a PushinPay.';
  end if;

  if coalesce(v_row.cashout_status, '') in (
    'sending',
    'created',
    'paid'
  ) then
    raise exception
      'Este saque já possui um envio em andamento.';
  end if;

  if coalesce(v_row.cashout_status, '') = 'review' then
    raise exception
      'Este saque precisa ser conferido no painel da PushinPay antes de qualquer nova tentativa.';
  end if;

  update public.withdrawals
  set
    auto_authorized_at =
      coalesce(
        auto_authorized_at,
        now()
      ),
    auto_authorized_by =
      coalesce(
        auto_authorized_by,
        p_admin_user_id
      ),
    cashout_status = 'sending',
    cashout_requested_at = now(),
    cashout_error = null
  where id = p_withdrawal_id
  returning *
  into v_row;

  insert into public.admin_audit_logs(
    admin_user_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values(
    p_admin_user_id,
    'authorize_pushinpay_cashout',
    'withdrawal',
    p_withdrawal_id,
    jsonb_build_object(
      'amount',
      v_row.amount,
      'net_amount',
      v_row.net_amount,
      'pix_key_type',
      v_row.pix_key_type
    )
  );

  return v_row;
end;
$$;

revoke all
on function public.service_claim_pushinpay_cashout(uuid,uuid)
from public, anon, authenticated;

grant execute
on function public.service_claim_pushinpay_cashout(uuid,uuid)
to service_role;

commit;
