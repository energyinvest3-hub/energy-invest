begin;

create schema if not exists private;

-- =========================================================
-- ENERGYINVEST - HARDENING DE SEGURANÇA PARA DEPÓSITOS / PIX
-- =========================================================


-- =========================================================
-- 1. TABELA PRIVADA DE AUDITORIA
-- =========================================================

create table if not exists private.deposit_security_events (
  id bigint generated always as identity primary key,

  occurred_at timestamptz not null default now(),

  operation text not null
    check (
      operation in (
        'INSERT',
        'UPDATE',
        'DELETE'
      )
    ),

  deposit_id uuid,

  user_id uuid,

  old_row jsonb,

  new_row jsonb,

  db_role text not null default current_user
);


-- Nenhum cliente da aplicação pode acessar diretamente
-- essa tabela de auditoria.
revoke all
on private.deposit_security_events
from public, anon, authenticated, service_role;



-- =========================================================
-- 2. ÍNDICES PARA AS VERIFICAÇÕES DE SEGURANÇA
-- =========================================================

create index if not exists deposits_security_user_created_idx
on public.deposits (
  user_id,
  created_at desc
);


create index if not exists deposits_security_user_status_created_idx
on public.deposits (
  user_id,
  status,
  created_at desc
);



-- =========================================================
-- 3. AUDITORIA DE ALTERAÇÕES EM DEPÓSITOS
-- =========================================================

create or replace function private.audit_deposit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin

  insert into private.deposit_security_events (
    operation,
    deposit_id,
    user_id,
    old_row,
    new_row,
    db_role
  )
  values (
    tg_op,

    coalesce(
      new.id,
      old.id
    ),

    coalesce(
      new.user_id,
      old.user_id
    ),

    case
      when tg_op in (
        'UPDATE',
        'DELETE'
      )
      then to_jsonb(old)
      else null
    end,

    case
      when tg_op in (
        'INSERT',
        'UPDATE'
      )
      then to_jsonb(new)
      else null
    end,

    current_user
  );

  return coalesce(
    new,
    old
  );

end;
$$;


revoke all
on function private.audit_deposit_change()
from public, anon, authenticated, service_role;


drop trigger if exists audit_deposit_change_trigger
on public.deposits;


create trigger audit_deposit_change_trigger
after insert or update or delete
on public.deposits
for each row
execute function private.audit_deposit_change();



-- =========================================================
-- 4. BLOQUEIA DELETE / TRUNCATE PELA APLICAÇÃO
-- =========================================================

revoke delete, truncate
on public.deposits
from anon, authenticated, service_role;



-- =========================================================
-- 5. PROTEÇÃO EXTRA:
--    BLOQUEIA QUALQUER DELETE DE DEPÓSITO
-- =========================================================
--
-- Mesmo se uma função privilegiada tentar apagar uma linha,
-- o trigger interrompe a operação.
--
-- Para manutenção legítima futura, o administrador precisa
-- desativar conscientemente o trigger pelo SQL Editor.
-- =========================================================

create or replace function private.prevent_deposit_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin

  raise exception
    'Financial history cannot be deleted. Disable the protection trigger manually for authorized maintenance.';

end;
$$;


revoke all
on function private.prevent_deposit_delete()
from public, anon, authenticated, service_role;


drop trigger if exists prevent_deposit_delete_trigger
on public.deposits;


create trigger prevent_deposit_delete_trigger
before delete
on public.deposits
for each row
execute function private.prevent_deposit_delete();



-- =========================================================
-- 6. RATE LIMIT PERSISTENTE NO BANCO
-- =========================================================
--
-- Proteções:
--
-- - serializa requests concorrentes do mesmo usuário;
-- - 1 novo PIX a cada 60 segundos;
-- - máximo 1 PIX pendente recente;
-- - máximo 20 cobranças em 24 horas.
--
-- Como isso roda no PostgreSQL, continua valendo mesmo que
-- alguém tente contornar o frontend ou a Vercel.
-- =========================================================

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

  -- Recuperações/importações de histórico concluído
  -- não são bloqueadas pelo limitador.
  if new.status <> 'pending' then
    return new;
  end if;


  -- =======================================================
  -- LOCK POR USUÁRIO
  -- =======================================================
  --
  -- Impede corrida de dezenas de requests simultâneos.
  --
  -- A segunda requisição precisa esperar a primeira
  -- terminar antes de continuar.
  -- =======================================================

  perform pg_advisory_xact_lock(
    hashtextextended(
      new.user_id::text,
      0
    )
  );


  -- =======================================================
  -- 1 PIX A CADA 60 SEGUNDOS
  -- =======================================================

  select
    max(d.created_at)
  into
    v_last_created_at
  from
    public.deposits d
  where
    d.user_id = new.user_id;


  if
    v_last_created_at is not null
    and
    v_last_created_at >
      now() - interval '60 seconds'
  then

    raise exception
      'Aguarde 60 segundos antes de gerar outro PIX.';

  end if;


  -- =======================================================
  -- NO MÁXIMO 1 PIX PENDENTE NOS ÚLTIMOS 15 MINUTOS
  -- =======================================================

  select
    count(*)
  into
    v_pending_count
  from
    public.deposits d
  where
    d.user_id = new.user_id
    and d.status = 'pending'
    and d.created_at >
      now() - interval '15 minutes';


  if v_pending_count >= 1 then

    raise exception
      'Já existe um PIX aguardando pagamento.';

  end if;


  -- =======================================================
  -- NO MÁXIMO 20 PIX EM 24 HORAS
  -- =======================================================

  select
    count(*)
  into
    v_daily_count
  from
    public.deposits d
  where
    d.user_id = new.user_id
    and d.created_at >
      now() - interval '24 hours';


  if v_daily_count >= 20 then

    raise exception
      'Limite diário de geração de PIX atingido.';

  end if;


  return new;

end;
$$;


revoke all
on function private.protect_deposit_creation()
from public, anon, authenticated, service_role;


drop trigger if exists protect_deposit_creation_trigger
on public.deposits;


create trigger protect_deposit_creation_trigger
before insert
on public.deposits
for each row
execute function private.protect_deposit_creation();



commit;
