-- EnergyInvest — controle de saques + PIX manual administrativo
begin;

create table if not exists public.withdrawal_control_settings (
  id boolean primary key default true check (id = true),
  automatic_processing_enabled boolean not null default false,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.withdrawal_control_settings(id, automatic_processing_enabled)
values(true, false)
on conflict (id) do nothing;

alter table public.withdrawals
  add column if not exists auto_authorized_at timestamptz,
  add column if not exists auto_authorized_by uuid references public.profiles(id);

create table if not exists public.admin_manual_pix (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id),
  recipient_name text not null,
  amount numeric(18,2) not null check (amount > 0),
  pix_key_type text not null check (pix_key_type in ('cpf','email','phone','random','other')),
  pix_key text not null,
  note text not null default '',
  status text not null default 'pending' check (status in ('pending','sent','cancelled')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.withdrawal_control_settings enable row level security;
alter table public.admin_manual_pix enable row level security;

revoke all on public.withdrawal_control_settings from public, anon, authenticated;
revoke all on public.admin_manual_pix from public, anon, authenticated;

create or replace function public.admin_set_automatic_withdrawals(
  p_enabled boolean
) returns public.withdrawal_control_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.withdrawal_control_settings%rowtype;
begin
  if v_user_id is null or not private.is_admin() then
    raise exception 'Administrator required';
  end if;

  update public.withdrawal_control_settings
  set automatic_processing_enabled = p_enabled,
      updated_by = v_user_id,
      updated_at = now()
  where id = true
  returning * into v_row;

  insert into public.admin_audit_logs(
    admin_user_id, action, target_type, metadata
  )
  values(
    v_user_id,
    'set_automatic_withdrawals',
    'withdrawal_settings',
    jsonb_build_object('enabled', p_enabled)
  );

  return v_row;
end;
$$;

revoke all on function public.admin_set_automatic_withdrawals(boolean)
  from public, anon;
grant execute on function public.admin_set_automatic_withdrawals(boolean)
  to authenticated;

create or replace function public.admin_authorize_automatic_withdrawal(
  p_withdrawal_id uuid
) returns public.withdrawals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.withdrawals%rowtype;
  v_enabled boolean;
begin
  if v_user_id is null or not private.is_admin() then
    raise exception 'Administrator required';
  end if;

  select automatic_processing_enabled
  into v_enabled
  from public.withdrawal_control_settings
  where id = true;

  if coalesce(v_enabled, false) = false then
    raise exception 'Automatic withdrawal processing is disabled';
  end if;

  select * into v_row
  from public.withdrawals
  where id = p_withdrawal_id
  for update;

  if not found then raise exception 'Withdrawal not found'; end if;
  if v_row.status <> 'pending' then raise exception 'Withdrawal is not pending'; end if;

  update public.withdrawals
  set auto_authorized_at = coalesce(auto_authorized_at, now()),
      auto_authorized_by = coalesce(auto_authorized_by, v_user_id)
  where id = p_withdrawal_id
  returning * into v_row;

  insert into public.admin_audit_logs(
    admin_user_id, action, target_type, target_id, metadata
  )
  values(
    v_user_id,
    'authorize_automatic_withdrawal',
    'withdrawal',
    p_withdrawal_id,
    jsonb_build_object('authorized', true)
  );

  return v_row;
end;
$$;

revoke all on function public.admin_authorize_automatic_withdrawal(uuid)
  from public, anon;
grant execute on function public.admin_authorize_automatic_withdrawal(uuid)
  to authenticated;

create or replace function public.admin_list_authorized_withdrawals()
returns setof public.withdrawals
language sql
security definer
set search_path = ''
as $$
  select w.*
  from public.withdrawals w
  join public.withdrawal_control_settings s on s.id = true
  where s.automatic_processing_enabled = true
    and w.status = 'pending'
    and w.auto_authorized_at is not null
    and private.is_admin()
  order by w.auto_authorized_at asc;
$$;

revoke all on function public.admin_list_authorized_withdrawals()
  from public, anon;
grant execute on function public.admin_list_authorized_withdrawals()
  to authenticated;

create or replace function public.admin_create_manual_pix(
  p_recipient_name text,
  p_amount numeric,
  p_pix_key_type text,
  p_pix_key text,
  p_note text default ''
) returns public.admin_manual_pix
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.admin_manual_pix%rowtype;
begin
  if v_user_id is null or not private.is_admin() then
    raise exception 'Administrator required';
  end if;
  if nullif(trim(coalesce(p_recipient_name,'')), '') is null then
    raise exception 'Recipient name required';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Invalid amount';
  end if;
  if p_pix_key_type not in ('cpf','email','phone','random','other') then
    raise exception 'Invalid PIX key type';
  end if;
  if nullif(trim(coalesce(p_pix_key,'')), '') is null then
    raise exception 'PIX key required';
  end if;

  insert into public.admin_manual_pix(
    created_by, recipient_name, amount, pix_key_type, pix_key, note
  )
  values(
    v_user_id, trim(p_recipient_name), round(p_amount, 2),
    p_pix_key_type, trim(p_pix_key), left(coalesce(p_note,''), 500)
  )
  returning * into v_row;

  insert into public.admin_audit_logs(
    admin_user_id, action, target_type, target_id, metadata
  )
  values(
    v_user_id, 'create_manual_pix', 'manual_pix', v_row.id,
    jsonb_build_object(
      'amount', v_row.amount,
      'recipient_name', v_row.recipient_name,
      'pix_key_type', v_row.pix_key_type
    )
  );

  return v_row;
end;
$$;

revoke all on function public.admin_create_manual_pix(text,numeric,text,text,text)
  from public, anon;
grant execute on function public.admin_create_manual_pix(text,numeric,text,text,text)
  to authenticated;

create or replace function public.admin_update_manual_pix(
  p_id uuid,
  p_status text
) returns public.admin_manual_pix
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.admin_manual_pix%rowtype;
begin
  if v_user_id is null or not private.is_admin() then
    raise exception 'Administrator required';
  end if;
  if p_status not in ('sent','cancelled') then
    raise exception 'Invalid status';
  end if;

  update public.admin_manual_pix
  set status = p_status,
      sent_at = case when p_status = 'sent' then coalesce(sent_at, now()) else sent_at end
  where id = p_id
    and status = 'pending'
  returning * into v_row;

  if not found then
    raise exception 'Manual PIX not found or already finalized';
  end if;

  insert into public.admin_audit_logs(
    admin_user_id, action, target_type, target_id, metadata
  )
  values(
    v_user_id, 'update_manual_pix', 'manual_pix', p_id,
    jsonb_build_object('status', p_status)
  );

  return v_row;
end;
$$;

revoke all on function public.admin_update_manual_pix(uuid,text)
  from public, anon;
grant execute on function public.admin_update_manual_pix(uuid,text)
  to authenticated;

commit;
