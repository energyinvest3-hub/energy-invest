-- EnergyInvest — painel de entrada R$50 limitado a 1 por pessoa
-- R$100 e R$150 continuam com a regra normal configurada no Admin.
begin;

update public.solar_projects
set max_units_per_user = 1
where investment_amount = 50;

create or replace function public.purchase_solar_project(
  p_project_id uuid,
  p_quantity integer
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_project public.solar_projects%rowtype;
  v_wallet public.wallets%rowtype;
  v_holding_id uuid;
  v_held integer;
  v_held_entry_50 integer := 0;
  v_total numeric(18,2);
  v_started timestamptz := now();
  v_day integer;
  v_target numeric(18,2);
  v_daily numeric(18,2);
  v_scheduled numeric(18,2) := 0;
  v_credit_amount numeric(18,2);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 100 then
    raise exception 'Invalid quantity';
  end if;

  select *
  into v_project
  from public.solar_projects
  where id = p_project_id
  for update;

  if not found
     or v_project.status not in ('available', 'active') then
    raise exception 'Project unavailable';
  end if;

  if v_project.investment_amount = 50 then
    if p_quantity <> 1 then
      raise exception 'O painel de entrada de R$50 é limitado a 1 unidade por pessoa.';
    end if;

    select coalesce(sum(up.quantity), 0)::integer
    into v_held_entry_50
    from public.user_projects up
    join public.solar_projects sp
      on sp.id = up.project_id
    where up.user_id = v_user_id
      and sp.investment_amount = 50;

    if v_held_entry_50 >= 1 then
      raise exception 'Você já utilizou o painel de entrada de R$50. O limite é 1 por pessoa.';
    end if;
  end if;

  select coalesce(sum(quantity), 0)::integer
  into v_held
  from public.user_projects
  where user_id = v_user_id
    and project_id = p_project_id;

  if p_quantity > v_project.available_units
     or v_held + p_quantity > v_project.max_units_per_user then
    raise exception 'Quantity above project limit';
  end if;

  select *
  into v_wallet
  from public.wallets
  where user_id = v_user_id
  for update;

  if not found then
    raise exception 'Wallet unavailable';
  end if;

  v_total := round(v_project.investment_amount * p_quantity, 2);

  if v_wallet.balance < v_total then
    raise exception 'Insufficient balance';
  end if;

  update public.wallets
  set balance = balance - v_total
  where id = v_wallet.id;

  insert into public.user_projects(
    user_id,
    project_id,
    quantity,
    amount_invested,
    started_at,
    ends_at,
    status
  )
  values(
    v_user_id,
    v_project.id,
    p_quantity,
    v_total,
    v_started,
    v_started + make_interval(days => v_project.duration_days),
    'active'
  )
  returning id into v_holding_id;

  v_target := round(v_total * v_project.return_multiplier, 2);
  v_daily := round(v_target / v_project.duration_days, 2);

  for v_day in 1..v_project.duration_days loop
    if v_day = v_project.duration_days then
      v_credit_amount :=
        greatest(0, round(v_target - v_scheduled, 2));
    else
      v_credit_amount := v_daily;
    end if;

    insert into public.project_credits(
      user_project_id,
      amount,
      credit_number,
      scheduled_at,
      status
    )
    values(
      v_holding_id,
      v_credit_amount,
      v_day,
      v_started + make_interval(days => v_day),
      'pending'
    );

    v_scheduled := v_scheduled + v_credit_amount;
  end loop;

  update public.solar_projects
  set
    available_units = available_units - p_quantity,
    status =
      case
        when available_units - p_quantity = 0
          then 'sold_out'
        else status
      end
  where id = v_project.id;

  insert into public.transactions(
    user_id,
    type,
    amount,
    description,
    status,
    reference_id
  )
  values(
    v_user_id,
    'purchase',
    -v_total,
    'Participação em ' || v_project.name,
    'completed',
    v_holding_id
  );

  insert into public.notifications(
    user_id,
    title,
    message
  )
  values(
    v_user_id,
    'Participação registrada',
    v_project.name ||
      ' já aparece em Meus painéis. O primeiro crédito está programado para 24 horas após a compra.'
  );

  return v_holding_id;
end;
$$;

revoke all
on function public.purchase_solar_project(uuid, integer)
from public, anon;

grant execute
on function public.purchase_solar_project(uuid, integer)
to authenticated;

commit;
