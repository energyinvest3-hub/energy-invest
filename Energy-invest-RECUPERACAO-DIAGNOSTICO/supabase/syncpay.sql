-- EnergyInvest + SyncPay
-- Execute depois de supabase/schema.sql.
-- As credenciais SyncPay NÃO pertencem a este arquivo.
-- Armazene-as no Supabase Vault com os nomes:
--   syncpay_client_id
--   syncpay_client_secret

alter table public.profiles add column if not exists cpf text;
alter table public.deposits add column if not exists provider text not null default 'syncpay';
alter table public.deposits add column if not exists pix_code text;
alter table public.deposits add column if not exists provider_status text;
alter table public.deposits add column if not exists paid_at timestamptz;
alter table public.deposits add column if not exists updated_at timestamptz not null default now();

create or replace function public.get_syncpay_credentials()
returns table(client_id text, client_secret text)
language sql
security definer
set search_path=''
as $$
  select
    (select decrypted_secret from vault.decrypted_secrets where name='syncpay_client_id' limit 1),
    (select decrypted_secret from vault.decrypted_secrets where name='syncpay_client_secret' limit 1);
$$;
revoke all on function public.get_syncpay_credentials() from public, anon, authenticated;
grant execute on function public.get_syncpay_credentials() to service_role;

create or replace function public.settle_syncpay_deposit(
  p_gateway_id text,
  p_amount numeric,
  p_status text
) returns public.deposits
language plpgsql
security definer
set search_path=''
as $$
declare
  v_deposit public.deposits%rowtype;
  v_tx_id uuid;
  v_status text := lower(coalesce(p_status,'pending'));
begin
  select * into v_deposit
  from public.deposits
  where gateway_id=p_gateway_id and provider='syncpay'
  for update;

  if not found then raise exception 'Deposit not found'; end if;
  if round(v_deposit.amount,2) <> round(p_amount,2) then
    raise exception 'Deposit amount mismatch';
  end if;

  if v_status in ('completed','paid') then
    if v_deposit.status='completed' then return v_deposit; end if;

    update public.deposits
      set status='completed', provider_status=v_status,
          paid_at=coalesce(paid_at,now()), updated_at=now()
      where id=v_deposit.id
      returning * into v_deposit;

    update public.wallets
      set balance=balance+v_deposit.amount,
          total_deposited=total_deposited+v_deposit.amount
      where user_id=v_deposit.user_id;

    select id into v_tx_id
    from public.transactions
    where reference_id=v_deposit.id and type='deposit'
    order by created_at desc limit 1;

    if v_tx_id is null then
      insert into public.transactions(user_id,type,amount,description,status,reference_id)
      values(v_deposit.user_id,'deposit',v_deposit.amount,'Recarga via PIX · SyncPay','completed',v_deposit.id);
    else
      update public.transactions
        set amount=v_deposit.amount,
            description='Recarga via PIX · SyncPay',
            status='completed'
        where id=v_tx_id;
    end if;

    insert into public.notifications(user_id,title,message)
    values(v_deposit.user_id,'PIX confirmado','Sua recarga foi confirmada e o saldo já está disponível.');

  elsif v_status in ('cancelled','refunded','expired','failed','refused') then
    if v_deposit.status <> 'completed' then
      update public.deposits
        set status='cancelled', provider_status=v_status, updated_at=now()
        where id=v_deposit.id
        returning * into v_deposit;

      update public.transactions
        set status='cancelled'
        where reference_id=v_deposit.id and type='deposit' and status='pending';
    end if;
  else
    update public.deposits
      set provider_status=v_status, updated_at=now()
      where id=v_deposit.id
      returning * into v_deposit;
  end if;

  return v_deposit;
end;
$$;
revoke all on function public.settle_syncpay_deposit(text,numeric,text) from public, anon, authenticated;
grant execute on function public.settle_syncpay_deposit(text,numeric,text) to service_role;

create index if not exists deposits_gateway_provider_idx
  on public.deposits(provider,gateway_id);
