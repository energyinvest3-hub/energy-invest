-- EnergyInvest bootstrap schema. Apply once to a NEW dedicated Supabase project.
-- Financial writes are deliberately unavailable to browser roles.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null default '', email text not null default '', phone text not null default '',
 avatar_url text, invite_code text unique, referred_by uuid references public.profiles(id),
 created_at timestamptz not null default now()
);
create table public.wallets (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id) on delete cascade,
 balance numeric(18,2) not null default 0 check(balance>=0),
 total_deposited numeric(18,2) not null default 0 check(total_deposited>=0),
 total_withdrawn numeric(18,2) not null default 0 check(total_withdrawn>=0),
 total_earned numeric(18,2) not null default 0 check(total_earned>=0),
 total_bonus numeric(18,2) not null default 0 check(total_bonus>=0), created_at timestamptz not null default now()
);
create table public.solar_projects (
 id uuid primary key default gen_random_uuid(), name text not null, description text not null,
 image_url text not null default '/solar-1.jpg', state text not null check(state in ('SP','RJ','MG','BA','CE','PE','GO','PR','RS','Europa','EUA','China')),
 city text not null, investment_amount numeric(18,2) not null check(investment_amount>=50),
 daily_projected_return numeric(18,2) not null check(daily_projected_return>=0),
 duration_days integer not null check(duration_days between 1 and 365),
 projected_total_return numeric(18,2) generated always as (daily_projected_return * duration_days) stored,
 available_units integer not null check(available_units>=0), max_units_per_user integer not null check(max_units_per_user between 1 and 1000),
 status text not null default 'available' check(status in ('available','active','finished','sold_out','paused')),
 start_date timestamptz not null, end_date timestamptz not null, created_at timestamptz not null default now(), check(end_date>start_date)
);
create table public.user_projects (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), project_id uuid not null references public.solar_projects(id),
 quantity integer not null check(quantity>0), amount_invested numeric(18,2) not null check(amount_invested>0),
 total_received numeric(18,2) not null default 0 check(total_received>=0), started_at timestamptz not null,
 ends_at timestamptz not null, status text not null check(status in ('active','finished')), created_at timestamptz not null default now(),
 check(ends_at>started_at)
);
create table public.project_credits (
 id uuid primary key default gen_random_uuid(), user_project_id uuid not null references public.user_projects(id),
 amount numeric(18,2) not null check(amount>=0), credit_number integer not null check(credit_number>0),
 scheduled_at timestamptz not null, credited_at timestamptz, status text not null default 'pending' check(status in ('pending','completed','cancelled')),
 unique(user_project_id,credit_number)
);
create table public.transactions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 type text not null check(type in ('deposit','purchase','credit','withdrawal','bonus')), amount numeric(18,2) not null,
 description text not null default '', status text not null check(status in ('pending','completed','cancelled')),
 reference_id uuid, created_at timestamptz not null default now()
);
create table public.withdrawals (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),
 amount numeric(18,2) not null check(amount>0), pix_key text not null, pix_key_type text not null check(pix_key_type in ('cpf','email','phone','random')),
 status text not null default 'pending' check(status in ('pending','completed','cancelled')),created_at timestamptz not null default now()
);
create table public.deposits (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id), amount numeric(18,2) not null check(amount>0),
 gateway_id text unique, status text not null default 'pending' check(status in ('pending','completed','cancelled')),created_at timestamptz not null default now()
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),title text not null,message text not null,
 read boolean not null default false,created_at timestamptz not null default now()
);
create table public.user_tasks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 task_key text not null check(task_key in ('security_review','projection_guide')),
 completed_at timestamptz not null default now(), unique(user_id,task_key)
);
create table public.goal_definitions (
 key text primary key check(key in ('panels_5','panels_10','holding_10_days','holding_30_days')),
 title text not null, description text not null,
 criterion_type text not null check(criterion_type in ('panel_count','holding_days')),
 target_value integer not null check(target_value>0),
 bonus_amount numeric(18,2) not null check(bonus_amount>=0),
 active boolean not null default true, sort_order integer not null default 0,
 created_at timestamptz not null default now()
);
create table public.user_rewards (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 goal_key text not null references public.goal_definitions(key),
 bonus_amount numeric(18,2) not null check(bonus_amount>=0),
 status text not null default 'pending' check(status in ('pending','approved','credited','cancelled')),
 claimed_at timestamptz not null default now(), credited_at timestamptz,
 unique(user_id,goal_key)
);
insert into public.goal_definitions(key,title,description,criterion_type,target_value,bonus_amount,sort_order) values
 ('panels_5','Tenha 5 painéis','Alcance um total de 5 cotas registradas em seus projetos.','panel_count',5,5,10),
 ('panels_10','Tenha 10 painéis','Alcance um total de 10 cotas registradas em seus projetos.','panel_count',10,15,20),
 ('holding_10_days','Mantenha um painel por 10 dias','Complete 10 dias desde o registro de uma participação.','holding_days',10,10,30),
 ('holding_30_days','Mantenha um painel por 30 dias','Complete 30 dias desde o registro de uma participação.','holding_days',30,30,40);
create table public.admin_audit_logs (
 id uuid primary key default gen_random_uuid(),
 admin_user_id uuid not null references public.profiles(id),
 action text not null, target_type text not null, target_id uuid,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
-- Queries using this helper also re-check current app metadata, avoiding stale ADMIN claims.
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=(select auth.uid()) and raw_app_meta_data->>'role'='ADMIN');
$$;
revoke all on function private.is_admin() from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.solar_projects enable row level security;
alter table public.user_projects enable row level security;
alter table public.project_credits enable row level security;
alter table public.transactions enable row level security;
alter table public.withdrawals enable row level security;
alter table public.deposits enable row level security;
alter table public.notifications enable row level security;
alter table public.user_tasks enable row level security;
alter table public.goal_definitions enable row level security;
alter table public.user_rewards enable row level security;
alter table public.admin_audit_logs enable row level security;
revoke all on public.profiles,public.wallets,public.solar_projects,public.user_projects,public.project_credits,public.transactions,public.withdrawals,public.deposits,public.notifications,public.user_tasks,public.goal_definitions,public.user_rewards,public.admin_audit_logs from anon,authenticated;
grant select on public.profiles,public.wallets,public.solar_projects,public.user_projects,public.project_credits,public.transactions,public.withdrawals,public.deposits,public.notifications,public.user_tasks,public.goal_definitions,public.user_rewards,public.admin_audit_logs to authenticated;
grant update(name,phone,avatar_url) on public.profiles to authenticated;
grant update(read) on public.notifications to authenticated;
grant insert(user_id,task_key) on public.user_tasks to authenticated;
grant insert(admin_user_id,action,target_type,target_id,metadata) on public.admin_audit_logs to authenticated;
grant insert(name,description,image_url,state,city,investment_amount,daily_projected_return,duration_days,available_units,max_units_per_user,status,start_date,end_date) on public.solar_projects to authenticated;
grant update(name,description,image_url,state,city,investment_amount,daily_projected_return,duration_days,available_units,max_units_per_user,status,start_date,end_date) on public.solar_projects to authenticated;

create policy profile_read on public.profiles for select to authenticated using(id=(select auth.uid()) or (select private.is_admin()));
create policy profile_edit on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy wallet_read on public.wallets for select to authenticated using(user_id=(select auth.uid()) or (select private.is_admin()));
create policy projects_read on public.solar_projects for select to authenticated using(true);
create policy projects_admin_insert on public.solar_projects for insert to authenticated with check((select private.is_admin()));
create policy projects_admin_update on public.solar_projects for update to authenticated using((select private.is_admin())) with check((select private.is_admin()));
create policy user_projects_read on public.user_projects for select to authenticated using(user_id=(select auth.uid()) or (select private.is_admin()));
create policy credits_read on public.project_credits for select to authenticated using(exists(select 1 from public.user_projects u where u.id=user_project_id and (u.user_id=(select auth.uid()) or (select private.is_admin()))));
create policy transactions_read on public.transactions for select to authenticated using(user_id=(select auth.uid()) or (select private.is_admin()));
create policy withdrawals_read on public.withdrawals for select to authenticated using(user_id=(select auth.uid()) or (select private.is_admin()));
create policy deposits_read on public.deposits for select to authenticated using(user_id=(select auth.uid()) or (select private.is_admin()));
create policy notifications_read on public.notifications for select to authenticated using(user_id=(select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy user_tasks_read on public.user_tasks for select to authenticated using(user_id=(select auth.uid()));
create policy user_tasks_insert on public.user_tasks for insert to authenticated with check(user_id=(select auth.uid()));
create policy goal_definitions_read on public.goal_definitions for select to authenticated using(active or (select private.is_admin()));
create policy user_rewards_read on public.user_rewards for select to authenticated using(user_id=(select auth.uid()) or (select private.is_admin()));
create policy audit_admin_read on public.admin_audit_logs for select to authenticated using((select private.is_admin()));
create policy audit_admin_insert on public.admin_audit_logs for insert to authenticated with check(admin_user_id=(select auth.uid()) and (select private.is_admin()));

-- Purchase uses authoritative project values and atomically debits the wallet,
-- creates the participation, schedules each credit and records the transaction.
create function public.purchase_solar_project(p_project_id uuid,p_quantity integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 v_user_id uuid := (select auth.uid());
 v_project public.solar_projects%rowtype;
 v_wallet public.wallets%rowtype;
 v_holding_id uuid;
 v_held integer;
 v_total numeric(18,2);
 v_started timestamptz := now();
 v_day integer;
 v_target numeric(18,2);
 v_daily numeric(18,2);
 v_scheduled numeric(18,2) := 0;
 v_credit_amount numeric(18,2);
begin
 if v_user_id is null then raise exception 'Authentication required'; end if;
 if p_quantity is null or p_quantity<1 or p_quantity>100 then raise exception 'Invalid quantity'; end if;
 select * into v_project from public.solar_projects where id=p_project_id for update;
 if not found or v_project.status not in ('available','active') then raise exception 'Project unavailable'; end if;
 select coalesce(sum(quantity),0)::integer into v_held from public.user_projects where user_id=v_user_id and project_id=p_project_id;
 if p_quantity>v_project.available_units or v_held+p_quantity>v_project.max_units_per_user then raise exception 'Quantity above project limit'; end if;
 select * into v_wallet from public.wallets where user_id=v_user_id for update;
 if not found then raise exception 'Wallet unavailable'; end if;
 v_total := round(v_project.investment_amount*p_quantity,2);
 if v_wallet.balance<v_total then raise exception 'Insufficient balance'; end if;
 update public.wallets set balance=balance-v_total where id=v_wallet.id;
 insert into public.user_projects(user_id,project_id,quantity,amount_invested,started_at,ends_at,status)
 values(v_user_id,v_project.id,p_quantity,v_total,v_started,v_started+make_interval(days=>v_project.duration_days),'active') returning id into v_holding_id;
 v_target := round(v_total*v_project.return_multiplier,2);
 v_daily := round(v_target/v_project.duration_days,2);
 for v_day in 1..v_project.duration_days loop
  if v_day=v_project.duration_days then v_credit_amount:=greatest(0,round(v_target-v_scheduled,2)); else v_credit_amount:=v_daily; end if;
  insert into public.project_credits(user_project_id,amount,credit_number,scheduled_at,status)
  values(v_holding_id,v_credit_amount,v_day,v_started+make_interval(days=>v_day),'pending');
  v_scheduled:=v_scheduled+v_credit_amount;
 end loop;
 update public.solar_projects set available_units=available_units-p_quantity,status=case when available_units-p_quantity=0 then 'sold_out' else status end where id=v_project.id;
 insert into public.transactions(user_id,type,amount,description,status,reference_id) values(v_user_id,'purchase',-v_total,'Participação em '||v_project.name,'completed',v_holding_id);
 insert into public.notifications(user_id,title,message) values(v_user_id,'Participação registrada',v_project.name||' já aparece em Meus painéis. O primeiro crédito está programado para 24 horas após a compra.');
 return v_holding_id;
end;$$;
revoke all on function public.purchase_solar_project(uuid,integer) from public,anon;
grant execute on function public.purchase_solar_project(uuid,integer) to authenticated;
-- Credits due are settled once, under a row lock. This function is private and
-- is intended for Supabase Cron; browsers cannot execute it.
create function private.process_due_project_credits(p_limit integer default 500) returns integer
language plpgsql security definer set search_path='' as $$
declare
 v_credit record;
 v_processed integer := 0;
begin
 if p_limit < 1 or p_limit > 5000 then raise exception 'Invalid batch size'; end if;
 for v_credit in
  select pc.id,pc.user_project_id,pc.amount,pc.credit_number,up.user_id
  from public.project_credits pc
  join public.user_projects up on up.id=pc.user_project_id
  where pc.status='pending' and pc.scheduled_at<=now() and up.status='active'
  order by pc.scheduled_at,pc.id
  for update of pc skip locked
  limit p_limit
 loop
  update public.project_credits set status='completed',credited_at=now()
  where id=v_credit.id and status='pending';
  if found then
   update public.user_projects set total_received=total_received+v_credit.amount
   where id=v_credit.user_project_id;
   update public.wallets set balance=balance+v_credit.amount,total_earned=total_earned+v_credit.amount
   where user_id=v_credit.user_id;
   insert into public.transactions(user_id,type,amount,description,status,reference_id)
   values(v_credit.user_id,'credit',v_credit.amount,'Crédito de projeto #'||v_credit.credit_number,'completed',v_credit.id);
   insert into public.notifications(user_id,title,message)
   values(v_credit.user_id,'Crédito registrado','Um crédito previsto do seu projeto foi registrado na carteira.');
   v_processed := v_processed+1;
  end if;
 end loop;
 update public.user_projects up set status='finished'
 where up.status='active' and up.ends_at<=now()
 and not exists(select 1 from public.project_credits pc where pc.user_project_id=up.id and pc.status='pending');
 return v_processed;
end;$$;
revoke all on function private.process_due_project_credits(integer) from public,anon,authenticated;

-- The browser can request a reward only through this server-validated function.
-- It never changes wallet balances; an administrator must credit it separately.
create function public.claim_goal_reward(p_goal_key text) returns public.user_rewards
language plpgsql security definer set search_path='' as $$
declare
 v_user_id uuid := (select auth.uid());
 v_goal public.goal_definitions%rowtype;
 v_current integer := 0;
 v_reward public.user_rewards%rowtype;
begin
 if v_user_id is null then raise exception 'Authentication required'; end if;
 select * into v_goal from public.goal_definitions where key=p_goal_key and active;
 if not found then raise exception 'Goal unavailable'; end if;
 if v_goal.criterion_type='panel_count' then
  select coalesce(sum(quantity),0)::integer into v_current
  from public.user_projects where user_id=v_user_id and status in ('active','finished');
 elsif v_goal.criterion_type='holding_days' then
  select coalesce(max(greatest(0,current_date-created_at::date)),0)::integer into v_current
  from public.user_projects where user_id=v_user_id and status in ('active','finished');
 end if;
 if v_current < v_goal.target_value then raise exception 'Goal not achieved'; end if;
 insert into public.user_rewards(user_id,goal_key,bonus_amount)
 values(v_user_id,v_goal.key,v_goal.bonus_amount)
 on conflict(user_id,goal_key) do update set goal_key=excluded.goal_key
 returning * into v_reward;
 return v_reward;
end;$$;
revoke all on function public.claim_goal_reward(text) from public,anon;
grant execute on function public.claim_goal_reward(text) to authenticated;

-- Only a current ADMIN can atomically turn an approved reward into wallet funds.
create function public.credit_goal_reward(p_reward_id uuid) returns public.user_rewards
language plpgsql security definer set search_path='' as $$
declare
 v_reward public.user_rewards%rowtype;
begin
 if not (select private.is_admin()) then raise exception 'Admin required'; end if;
 select * into v_reward from public.user_rewards where id=p_reward_id for update;
 if not found then raise exception 'Reward not found'; end if;
 if v_reward.status='credited' then return v_reward; end if;
 if v_reward.status='cancelled' then raise exception 'Reward cancelled'; end if;
 update public.wallets set balance=balance+v_reward.bonus_amount,
  total_earned=total_earned+v_reward.bonus_amount,
  total_bonus=total_bonus+v_reward.bonus_amount
 where user_id=v_reward.user_id;
 insert into public.transactions(user_id,type,amount,description,status,reference_id)
 values(v_reward.user_id,'bonus',v_reward.bonus_amount,'Bônus de meta: '||v_reward.goal_key,'completed',v_reward.id);
 update public.user_rewards set status='credited',credited_at=now() where id=v_reward.id returning * into v_reward;
 insert into public.admin_audit_logs(admin_user_id,action,target_type,target_id,metadata)
 values((select auth.uid()),'credit_goal_reward','user_reward',v_reward.id,jsonb_build_object('amount',v_reward.bonus_amount,'goal_key',v_reward.goal_key));
 return v_reward;
end;$$;
revoke all on function public.credit_goal_reward(uuid) from public,anon;
grant execute on function public.credit_goal_reward(uuid) to authenticated;

-- Trigger runs only as part of a trusted auth.users insertion, not as a public RPC.
-- Signup can occur before auth.uid() exists; NEW.id is the authoritative identity.
create function private.on_user_created() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,name,email,phone,invite_code,referred_by)
 values(new.id,coalesce(new.raw_user_meta_data->>'name',''),coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'phone',''),upper(substr(replace(new.id::text,'-',''),1,12)),
 (select p.id from public.profiles p where p.invite_code=nullif(new.raw_user_meta_data->>'invite_code','') limit 1));
 insert into public.wallets(user_id) values(new.id);
 insert into public.notifications(user_id,title,message) values(new.id,'Bem-vindo à EnergyInvest','Sua conta está pronta. Conheça os projetos disponíveis.');
 return new;
end;$$;
revoke all on function private.on_user_created() from public,anon,authenticated;
create trigger create_energy_profile after insert on auth.users for each row execute function private.on_user_created();

create index user_projects_user_idx on public.user_projects(user_id,created_at desc);
create index user_projects_project_idx on public.user_projects(project_id);
create index transactions_user_idx on public.transactions(user_id,created_at desc);
create index notifications_user_idx on public.notifications(user_id,created_at desc);
create index withdrawals_user_idx on public.withdrawals(user_id,created_at desc);
create index deposits_user_idx on public.deposits(user_id,created_at desc);
create index profiles_referred_idx on public.profiles(referred_by);
create index user_tasks_user_idx on public.user_tasks(user_id,completed_at desc);
create index user_rewards_user_idx on public.user_rewards(user_id,claimed_at desc);
create index user_rewards_status_idx on public.user_rewards(status,claimed_at desc);
create index admin_audit_created_idx on public.admin_audit_logs(created_at desc);

-- Future financial backend must use atomic transactions/locks and idempotent verified
-- webhook events. Browser roles cannot mutate balances or execute the credit processor.
commit;
