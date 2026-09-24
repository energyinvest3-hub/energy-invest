begin;

-- Índices para as verificações de segurança não pesarem no banco.
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


-- Proteção centralizada contra criação abusiva de depósitos.
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

  /*
   * Serializa a criação de depósitos por usuário.
   *
   * Isso evita corrida onde dezenas de requests chegam
   * simultaneamente e todas passam na checagem antes
   * do primeiro INSERT terminar.
   */
  perform pg_advisory_xact_lock(
    hashtextextended(
      new.user_id::text,
      0
    )
  );


  /*
   * =========================================
   * 1 PIX NOVO A CADA 60 SEGUNDOS
   * =========================================
   */
  select max(d.created_at)
  into v_last_created_at
  from public.deposits d
  where d.user_id = new.user_id;

  if
    v_last_created_at is not null
    and
    v_last_created_at >
      now() - interval '60 seconds'
  then
    raise exception
      'Aguarde 60 segundos antes de gerar outro PIX.';
  end if;


  /*
   * =========================================
   * SOMENTE 1 PIX PENDENTE NOS ÚLTIMOS 15 MIN
   * =========================================
   */
  select count(*)
  into v_pending_count
  from public.deposits d
  where
    d.user_id = new.user_id
    and d.status = 'pending'
    and d.created_at >
      now() - interval '15 minutes';

  if v_pending_count >= 1 then
    raise exception
      'Já existe um PIX aguardando pagamento.';
  end if;


  /*
   * =========================================
   * NO MÁXIMO 20 PIX EM 24 HORAS
   * =========================================
   */
  select count(*)
  into v_daily_count
  from public.deposits d
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
from public, anon, authenticated;


drop trigger if exists
protect_deposit_creation_trigger
on public.deposits;


create trigger
protect_deposit_creation_trigger
before insert
on public.deposits
for each row
execute function private.protect_deposit_creation();


commit;
