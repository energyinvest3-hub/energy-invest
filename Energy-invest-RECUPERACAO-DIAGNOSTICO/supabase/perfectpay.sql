-- EnergyInvest + Perfect Pay
-- Aplique depois de supabase/schema.sql e, se já existir, depois de supabase/syncpay.sql.
begin;

alter table public.profiles add column if not exists cpf text;

alter table public.deposits add column if not exists provider text;
update public.deposits set provider = 'syncpay' where provider is null;
alter table public.deposits alter column provider set default 'perfectpay';
alter table public.deposits alter column provider set not null;

alter table public.deposits add column if not exists provider_status text;
alter table public.deposits add column if not exists paid_at timestamptz;
alter table public.deposits add column if not exists updated_at timestamptz not null default now();
alter table public.deposits add column if not exists customer_email text;
alter table public.deposits add column if not exists customer_cpf text;
alter table public.deposits add column if not exists checkout_url text;
alter table public.deposits add column if not exists provider_sale_code text;
alter table public.deposits add column if not exists expected_product_code text;
alter table public.deposits add column if not exists expected_plan_code text;
alter table public.deposits add column if not exists reversal_pending boolean not null default false;
alter table public.deposits add column if not exists reversed_at timestamptz;

create index if not exists deposits_provider_user_status_idx
  on public.deposits(provider, user_id, status, created_at desc);

create unique index if not exists deposits_perfectpay_sale_unique
  on public.deposits(provider_sale_code)
  where provider = 'perfectpay' and provider_sale_code is not null;

create or replace function public.create_perfectpay_deposit(
  p_amount numeric,
  p_cpf text,
  p_customer_email text,
  p_checkout_url text,
  p_expected_product_code text default null,
  p_expected_plan_code text default null
) returns public.deposits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_deposit public.deposits%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 100000 then
    raise exception 'Invalid amount';
  end if;
  if length(v_cpf) <> 11 then raise exception 'Invalid CPF'; end if;

  select lower(email) into v_email
  from auth.users
  where id = v_user_id;

  if v_email is null then raise exception 'User email unavailable'; end if;

  if lower(trim(coalesce(p_customer_email, ''))) <> v_email then
    raise exception 'Customer email must match authenticated user';
  end if;

  update public.deposits
  set status = 'cancelled',
      provider_status = coalesce(provider_status, 'expired_local'),
      updated_at = now()
  where user_id = v_user_id
    and provider = 'perfectpay'
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
        and provider = 'perfectpay'
        and status = 'cancelled'
        and provider_status = 'expired_local'
    );

  if exists (
    select 1 from public.deposits
    where user_id = v_user_id
      and provider = 'perfectpay'
      and status = 'pending'
      and created_at >= now() - interval '30 minutes'
  ) then
    raise exception 'Você já possui um pagamento aguardando conclusão.';
  end if;

  insert into public.deposits(
    user_id, amount, status, provider, provider_status,
    customer_email, customer_cpf, checkout_url,
    expected_product_code, expected_plan_code, updated_at
  )
  values(
    v_user_id, round(p_amount, 2), 'pending', 'perfectpay', 'pending',
    v_email, v_cpf, p_checkout_url,
    nullif(trim(coalesce(p_expected_product_code, '')), ''),
    nullif(trim(coalesce(p_expected_plan_code, '')), ''),
    now()
  )
  returning * into v_deposit;

  insert into public.transactions(
    user_id, type, amount, description, status, reference_id
  )
  values(
    v_user_id, 'deposit', v_deposit.amount,
    'Pagamento de painel solar via Perfect Pay',
    'pending', v_deposit.id
  );

  return v_deposit;
end;
$$;

revoke all on function public.create_perfectpay_deposit(
  numeric, text, text, text, text, text
) from public, anon;

grant execute on function public.create_perfectpay_deposit(
  numeric, text, text, text, text, text
) to authenticated;

create or replace function public.process_perfectpay_webhook(
  p_sale_code text,
  p_amount numeric,
  p_status text,
  p_customer_email text,
  p_product_code text default null,
  p_plan_code text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deposit public.deposits%rowtype;
  v_wallet public.wallets%rowtype;
  v_tx_id uuid;
  v_status text := lower(trim(coalesce(p_status, 'unknown')));
  v_email text := lower(trim(coalesce(p_customer_email, '')));
  v_product text := nullif(trim(coalesce(p_product_code, '')), '');
  v_plan text := nullif(trim(coalesce(p_plan_code, '')), '');
begin
  if nullif(trim(coalesce(p_sale_code, '')), '') is null then
    raise exception 'Missing sale code';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Invalid amount';
  end if;

  select * into v_deposit
  from public.deposits
  where provider = 'perfectpay'
    and provider_sale_code = p_sale_code
  for update;

  if not found then
    select * into v_deposit
    from public.deposits
    where provider = 'perfectpay'
      and status = 'pending'
      and lower(coalesce(customer_email, '')) = v_email
      and round(amount, 2) = round(p_amount, 2)
      and created_at >= now() - interval '48 hours'
    order by created_at desc
    limit 1
    for update;
  end if;

  if not found then
    return jsonb_build_object(
      'processed', false,
      'reason', 'no_matching_deposit',
      'saleCode', p_sale_code
    );
  end if;

  if v_deposit.expected_product_code is not null
     and v_deposit.expected_product_code <> coalesce(v_product, '') then
    return jsonb_build_object(
      'processed', false,
      'reason', 'product_mismatch',
      'depositId', v_deposit.id
    );
  end if;

  if v_deposit.expected_plan_code is not null
     and v_deposit.expected_plan_code <> coalesce(v_plan, '') then
    return jsonb_build_object(
      'processed', false,
      'reason', 'plan_mismatch',
      'depositId', v_deposit.id
    );
  end if;

  if round(v_deposit.amount, 2) <> round(p_amount, 2) then
    return jsonb_build_object(
      'processed', false,
      'reason', 'amount_mismatch',
      'depositId', v_deposit.id
    );
  end if;

  if lower(coalesce(v_deposit.customer_email, '')) <> v_email then
    return jsonb_build_object(
      'processed', false,
      'reason', 'email_mismatch',
      'depositId', v_deposit.id
    );
  end if;

  if v_deposit.provider_sale_code is null then
    update public.deposits
    set provider_sale_code = p_sale_code,
        gateway_id = p_sale_code,
        provider_status = v_status,
        updated_at = now()
    where id = v_deposit.id
    returning * into v_deposit;
  end if;

  if v_status in ('approved', 'completed') then
    if v_deposit.status = 'completed' then
      update public.deposits
      set provider_status = v_status, updated_at = now()
      where id = v_deposit.id;

      return jsonb_build_object(
        'processed', true,
        'idempotent', true,
        'depositId', v_deposit.id,
        'status', 'completed'
      );
    end if;

    if v_deposit.status = 'cancelled' then
      return jsonb_build_object(
        'processed', false,
        'reason', 'deposit_already_cancelled',
        'depositId', v_deposit.id
      );
    end if;

    update public.deposits
    set status = 'completed',
        provider_status = v_status,
        paid_at = coalesce(paid_at, now()),
        reversal_pending = false,
        updated_at = now()
    where id = v_deposit.id
    returning * into v_deposit;

    update public.wallets
    set balance = balance + v_deposit.amount,
        total_deposited = total_deposited + v_deposit.amount
    where user_id = v_deposit.user_id;

    if not found then raise exception 'Wallet unavailable'; end if;

    select id into v_tx_id
    from public.transactions
    where reference_id = v_deposit.id and type = 'deposit'
    order by created_at desc
    limit 1;

    if v_tx_id is null then
      insert into public.transactions(
        user_id, type, amount, description, status, reference_id
      )
      values(
        v_deposit.user_id, 'deposit', v_deposit.amount,
        'Pagamento de painel solar via Perfect Pay',
        'completed', v_deposit.id
      );
    else
      update public.transactions
      set amount = v_deposit.amount,
          description = 'Pagamento de painel solar via Perfect Pay',
          status = 'completed'
      where id = v_tx_id;
    end if;

    insert into public.notifications(user_id, title, message)
    values(
      v_deposit.user_id,
      'Pagamento confirmado',
      'Seu pagamento pela Perfect Pay foi confirmado e o saldo já está disponível.'
    );

    return jsonb_build_object(
      'processed', true,
      'credited', true,
      'depositId', v_deposit.id,
      'status', 'completed'
    );
  end if;

  if v_status in (
    'rejected', 'cancelled', 'refunded',
    'charged_back', 'checkout_error', 'expired'
  ) then
    if v_deposit.status = 'completed' then
      select * into v_wallet
      from public.wallets
      where user_id = v_deposit.user_id
      for update;

      if not found then raise exception 'Wallet unavailable'; end if;

      if v_wallet.balance >= v_deposit.amount then
        update public.wallets
        set balance = balance - v_deposit.amount,
            total_deposited = greatest(
              0, total_deposited - v_deposit.amount
            )
        where user_id = v_deposit.user_id;

        update public.deposits
        set status = 'cancelled',
            provider_status = v_status,
            reversal_pending = false,
            reversed_at = now(),
            updated_at = now()
        where id = v_deposit.id
        returning * into v_deposit;

        update public.transactions
        set status = 'cancelled',
            description = 'Pagamento Perfect Pay revertido'
        where reference_id = v_deposit.id
          and type = 'deposit';

        insert into public.notifications(user_id, title, message)
        values(
          v_deposit.user_id,
          'Pagamento revertido',
          'A Perfect Pay informou cancelamento, reembolso ou chargeback e o crédito disponível foi revertido.'
        );

        return jsonb_build_object(
          'processed', true,
          'reversed', true,
          'depositId', v_deposit.id,
          'status', 'cancelled'
        );
      end if;

      update public.deposits
      set provider_status = v_status,
          reversal_pending = true,
          updated_at = now()
      where id = v_deposit.id;

      insert into public.notifications(user_id, title, message)
      values(
        v_deposit.user_id,
        'Pagamento em revisão',
        'A Perfect Pay informou uma reversão após o crédito. A conta foi sinalizada para revisão financeira.'
      );

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
  set provider_status = v_status,
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

revoke all on function public.process_perfectpay_webhook(
  text, numeric, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.process_perfectpay_webhook(
  text, numeric, text, text, text, text
) to service_role;

commit;
