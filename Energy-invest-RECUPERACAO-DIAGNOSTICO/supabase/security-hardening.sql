begin;

create schema if not exists private;

-- Audit trail separado da tabela financeira.
create table if not exists private.deposit_security_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  deposit_id uuid,
  user_id uuid,
  old_row jsonb,
  new_row jsonb,
  db_role text not null default current_user
);

revoke all on private.deposit_security_events
from public, anon, authenticated, service_role;

-- Índices para as verificações de segurança.
create index if not exists deposits_security_user_created_idx
  on public.deposits (user_id, created_at desc);

create index if not exists deposits_security_user_status_created_idx
  on public.deposits (user_id, status, created_at desc);

-- Registra toda alteração em depósitos.
create or replace function private.audit_deposit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.deposit_security_events(
    operation,
    deposit_id,
    user_id,
    old_row,
    new_row,
    db_role
  )
  values(
    tg_op,
    coalesce(new.id, old.id),
    coalesce(new.user_id, old.user_id),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end,
    current_user
  );

  return coalesce(new, old);
end;
$$;

revoke all on function private.audit_deposit_change()
from public, anon, authenticated, service_role;

drop trigger if exists audit_deposit_change_trigger
on public.deposits;

create trigger audit_deposit_change_trigger
after insert or update or delete
on public.deposits
for each row
execute function private.audit_deposit_change();

-- Bloqueia DELETE via anon/authenticated/service_role.
-- SQL Editor / owner do banco ainda consegue executar manutenção.
revoke delete, truncate on public.deposits
from anon, authenticated, service_role;

create or replace function private.prevent_deposit_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Financial history cannot be deleted through application roles.';
  end if;

  return old;
end;
$$;

revoke all on function private.prevent_deposit_delete()
from public, anon, authenticated, service_role;

drop trigger if exists prevent_deposit_delete_trigger
on public.deposits;

create trigger prevent_deposit_delete_trigger
before delete
on public.deposits
for each row
execute function private.prevent_deposit_delete();

-- Rate-limit persistente no banco para NOVAS cobranças pendentes.
create or replace function private.protect_deposit_creation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last_created_at timestamptz;
  v_pending_count integer;
  v_daily_count integer;
begin
  -- Recuperações/importações de histórico concluído não entram no limitador.
  if new.status <> 'pending' then
    return new;
  end if;

  -- Serializa requisições concorrentes do mesmo usuário.
  perform pg_advisory_xact_lock(
    hashtextextended(new.user_id::text, 0)
  );

  select max(d.created_at)
    into v_last_created_at
  from public.deposits d
  where d.user_id = new.user_id;

  if v_last_created_at is not null
     and v_last_created_at > now() - interval '60 seconds'
  then
    raise exception 'Aguarde 60 segundos antes de gerar outro PIX.';
  end if;

  select count(*)
    into v_pending_count
  from public.deposits d
  where d.user_id = new.user_id
    and d.status = 'pending'
    and d.created_at > now() - interval '15 minutes';

  if v_pending_count >= 1 then
    raise exception 'Já existe um PIX aguardando pagamento.';
  end if;

  select count(*)
    into v_daily_count
  from public.deposits d
  where d.user_id = new.user_id
    and d.created_at > now() - interval '24 hours';

  if v_daily_count >= 20 then
    raise exception 'Limite diário de geração de PIX atingido.';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_deposit_creation()
from public, anon, authenticated, service_role;

drop trigger if exists protect_deposit_creation_trigger
on public.deposits;

create trigger protect_deposit_creation_trigger
before insert
on public.deposits
for each row
execute function private.protect_deposit_creation();

commit;
