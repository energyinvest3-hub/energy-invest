-- EnergyInvest / PushinPay reliability
begin;

alter table public.deposits
  add column if not exists provider_checked_at timestamptz;

create index if not exists deposits_pushinpay_reconcile_idx
  on public.deposits(user_id, status, provider_checked_at, created_at desc)
  where provider = 'pushinpay' and gateway_id is not null;

create or replace function public.create_pushinpay_deposit(p_amount numeric)
returns public.deposits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_deposit public.deposits%rowtype;
  v_pending_count integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 100000 then
    raise exception 'Invalid amount';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_user_id::text)::bigint
  );

  update public.deposits
  set status = 'cancelled',
      provider_status = 'expired_local',
      updated_at = now()
  where user_id = v_user_id
    and provider = 'pushinpay'
    and status = 'pending'
    and created_at < now() - interval '30 minutes';

  update public.transactions
  set status = 'cancelled'
  where user_id = v_user_id
    and type = 'deposit'
    and status = 'pending'
    and reference_id in (
      select id
      from public.deposits
      where user_id = v_user_id
        and provider = 'pushinpay'
        and status = 'cancelled'
        and provider_status = 'expired_local'
    );

  select count(*)::integer
  into v_pending_count
  from public.deposits
  where user_id = v_user_id
    and provider = 'pushinpay'
    and status = 'pending'
    and created_at >= now() - interval '30 minutes';

  if v_pending_count >= 5 then
    raise exception 'Você já possui 5 PIX aguardando pagamento.';
  end if;

  insert into public.deposits(
    user_id, amount, status, provider, provider_status, updated_at
  )
  values(
    v_user_id, round(p_amount, 2), 'pending', 'pushinpay', 'creating', now()
  )
  returning * into v_deposit;

  insert into public.transactions(
    user_id, type, amount, description, status, reference_id
  )
  values(
    v_user_id, 'deposit', v_deposit.amount,
    'Recarga via PIX · PushinPay', 'pending', v_deposit.id
  );

  return v_deposit;
end;
$$;

revoke all on function public.create_pushinpay_deposit(numeric)
  from public, anon;
grant execute on function public.create_pushinpay_deposit(numeric)
  to authenticated;

create or replace function public.claim_pushinpay_reconciliation(
  p_deposit_id uuid,
  p_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deposit public.deposits%rowtype;
  v_provider_status text;
begin
  select * into v_deposit
  from public.deposits
  where id = p_deposit_id
    and user_id = p_user_id
    and provider = 'pushinpay'
  for update;

  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'not_found');
  end if;

  if v_deposit.gateway_id is null then
    return jsonb_build_object('claimed', false, 'reason', 'missing_gateway_id');
  end if;

  if v_deposit.status = 'completed' then
    return jsonb_build_object('claimed', false, 'reason', 'already_completed');
  end if;

  v_provider_status := lower(trim(coalesce(v_deposit.provider_status, '')));

  if v_deposit.status = 'cancelled'
     and v_provider_status in ('canceled', 'cancelled', 'expired') then
    return jsonb_build_object('claimed', false, 'reason', 'provider_final');
  end if;

  if v_deposit.provider_checked_at is not null
     and v_deposit.provider_checked_at > now() - interval '60 seconds' then
    return jsonb_build_object('claimed', false, 'reason', 'too_soon');
  end if;

  update public.deposits
  set provider_checked_at = now(),
      updated_at = now()
  where id = v_deposit.id;

  return jsonb_build_object(
    'claimed', true,
    'depositId', v_deposit.id,
    'gatewayId', v_deposit.gateway_id,
    'amount', v_deposit.amount
  );
end;
$$;

revoke all on function public.claim_pushinpay_reconciliation(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_pushinpay_reconciliation(uuid, uuid)
  to service_role;

create or replace function public.settle_pushinpay_deposit(
  p_gateway_id text,
  p_value_cents bigint,
  p_status text,
  p_end_to_end_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deposit public.deposits%rowtype;
  v_tx_id uuid;
  v_status text := lower(trim(coalesce(p_status, '')));
  v_amount numeric;
begin
  if nullif(trim(coalesce(p_gateway_id, '')), '') is null then
    raise exception 'Missing gateway id';
  end if;

  if p_value_cents is null or p_value_cents < 0 then
    raise exception 'Invalid value';
  end if;

  v_amount := round((p_value_cents::numeric / 100), 2);

  select * into v_deposit
  from public.deposits
  where provider = 'pushinpay'
    and gateway_id = p_gateway_id
  for update;

  if not found then
    return jsonb_build_object(
      'processed', false,
      'reason', 'deposit_not_found',
      'gatewayId', p_gateway_id
    );
  end if;

  if round(v_deposit.amount, 2) <> v_amount then
    raise exception 'Deposit amount mismatch';
  end if;

  if v_status = 'paid' then
    if v_deposit.status = 'completed' then
      update public.deposits
      set provider_status = 'paid',
          end_to_end_id = coalesce(nullif(p_end_to_end_id, ''), end_to_end_id),
          provider_checked_at = now(),
          updated_at = now()
      where id = v_deposit.id;

      return jsonb_build_object(
        'processed', true,
        'idempotent', true,
        'credited', false,
        'depositId', v_deposit.id,
        'userId', v_deposit.user_id,
        'status', 'completed'
      );
    end if;

    update public.deposits
    set status = 'completed',
        provider_status = 'paid',
        end_to_end_id = coalesce(nullif(p_end_to_end_id, ''), end_to_end_id),
        paid_at = coalesce(paid_at, now()),
        provider_checked_at = now(),
        updated_at = now(),
        reversal_pending = false
    where id = v_deposit.id
    returning * into v_deposit;

    update public.wallets
    set balance = balance + v_deposit.amount,
        total_deposited = total_deposited + v_deposit.amount
    where user_id = v_deposit.user_id;

    if not found then
      raise exception 'Wallet unavailable';
    end if;

    select id into v_tx_id
    from public.transactions
    where reference_id = v_deposit.id
      and type = 'deposit'
    order by created_at desc
    limit 1;

    if v_tx_id is null then
      insert into public.transactions(
        user_id, type, amount, description, status, reference_id
      )
      values(
        v_deposit.user_id,
        'deposit',
        v_deposit.amount,
        'Recarga via PIX · PushinPay',
        'completed',
        v_deposit.id
      );
    else
      update public.transactions
      set user_id = v_deposit.user_id,
          amount = v_deposit.amount,
          description = 'Recarga via PIX · PushinPay',
          status = 'completed'
      where id = v_tx_id;
    end if;

    insert into public.notifications(user_id, title, message)
    values(
      v_deposit.user_id,
      'PIX confirmado',
      'Seu pagamento PIX foi confirmado e o saldo já está disponível.'
    );

    return jsonb_build_object(
      'processed', true,
      'credited', true,
      'depositId', v_deposit.id,
      'userId', v_deposit.user_id,
      'amount', v_deposit.amount,
      'status', 'completed'
    );
  end if;

  if v_status in ('canceled', 'cancelled', 'expired') then
    if v_deposit.status = 'completed' then
      update public.deposits
      set provider_status = v_status,
          reversal_pending = true,
          provider_checked_at = now(),
          updated_at = now()
      where id = v_deposit.id;

      return jsonb_build_object(
        'processed', true,
        'reviewRequired', true,
        'depositId', v_deposit.id,
        'status', 'completed'
      );
    end if;

    update public.deposits
    set status = 'cancelled',
        provider_status = v_status,
        end_to_end_id = coalesce(nullif(p_end_to_end_id, ''), end_to_end_id),
        provider_checked_at = now(),
        updated_at = now()
    where id = v_deposit.id
    returning * into v_deposit;

    update public.transactions
    set status = 'cancelled'
    where reference_id = v_deposit.id
      and type = 'deposit'
      and status = 'pending';

    return jsonb_build_object(
      'processed', true,
      'cancelled', true,
      'depositId', v_deposit.id,
      'status', 'cancelled'
    );
  end if;

  update public.deposits
  set provider_status = nullif(v_status, ''),
      end_to_end_id = coalesce(nullif(p_end_to_end_id, ''), end_to_end_id),
      provider_checked_at = now(),
      updated_at = now()
  where id = v_deposit.id;

  return jsonb_build_object(
    'processed', true,
    'credited', false,
    'depositId', v_deposit.id,
    'status', v_deposit.status,
    'providerStatus', v_status
  );
end;
$$;

revoke all on function public.settle_pushinpay_deposit(text, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.settle_pushinpay_deposit(text, bigint, text, text)
  to service_role;

commit;
