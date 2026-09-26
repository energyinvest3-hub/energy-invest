-- EnergyInvest — convite especial JV1164778
-- Regra: 35% uma única vez por convidado, sobre o primeiro depósito completed
-- OU a primeira compra, o que acontecer primeiro.
begin;

create table if not exists public.special_referral_rules (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null unique references public.profiles(id) on delete cascade,
  invite_code text not null unique,
  reward_percent numeric(6,2) not null check (reward_percent > 0 and reward_percent <= 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists private.special_referral_pending (
  email text primary key,
  invite_code text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.special_referral_signups (
  referred_user_id uuid primary key references public.profiles(id) on delete cascade,
  referrer_user_id uuid not null references public.profiles(id) on delete cascade,
  invite_code text not null,
  joined_at timestamptz not null default now()
);

create table if not exists public.special_referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referred_user_id uuid not null unique references public.profiles(id) on delete cascade,
  referrer_user_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null check (source_type in ('deposit','purchase')),
  source_id uuid not null,
  source_amount numeric(18,2) not null check (source_amount > 0),
  reward_percent numeric(6,2) not null,
  reward_amount numeric(18,2) not null check (reward_amount >= 0),
  created_at timestamptz not null default now()
);

alter table public.special_referral_rules enable row level security;
alter table public.special_referral_signups enable row level security;
alter table public.special_referral_rewards enable row level security;
revoke all on public.special_referral_rules from public, anon, authenticated;
revoke all on public.special_referral_signups from public, anon, authenticated;
revoke all on public.special_referral_rewards from public, anon, authenticated;
revoke all on private.special_referral_pending from public, anon, authenticated;

do $$
declare
  v_user_id uuid;
  v_taken_by uuid;
begin
  select id into v_user_id
  from public.profiles
  where lower(email) = lower('Jv1164778@gmail.com')
  limit 1;

  if v_user_id is null then
    raise exception 'Conta Jv1164778@gmail.com não encontrada em public.profiles';
  end if;

  select id into v_taken_by
  from public.profiles
  where upper(coalesce(invite_code,'')) = 'JV1164778'
    and id <> v_user_id
  limit 1;

  if v_taken_by is not null then
    raise exception 'O código JV1164778 já pertence a outra conta';
  end if;

  update public.profiles
  set invite_code = 'JV1164778'
  where id = v_user_id;

  insert into public.special_referral_rules(referrer_user_id,invite_code,reward_percent,active)
  values(v_user_id,'JV1164778',35.00,true)
  on conflict (referrer_user_id)
  do update set invite_code=excluded.invite_code,reward_percent=excluded.reward_percent,active=true;
end;
$$;

create or replace function public.prepare_special_referral_signup(p_email text,p_invite_code text)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare v_code text := upper(trim(coalesce(p_invite_code,'')));
begin
  if nullif(trim(coalesce(p_email,'')), '') is null then raise exception 'E-mail inválido'; end if;
  if not exists (
    select 1 from public.special_referral_rules
    where upper(invite_code)=v_code and active=true
  ) then return false; end if;

  insert into private.special_referral_pending(email,invite_code,created_at)
  values(lower(trim(p_email)),v_code,now())
  on conflict (email) do update set invite_code=excluded.invite_code,created_at=now();
  return true;
end;
$$;
revoke all on function public.prepare_special_referral_signup(text,text) from public,anon,authenticated;
grant execute on function public.prepare_special_referral_signup(text,text) to service_role;

create or replace function private.consume_special_referral_pending()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_code text; v_referrer uuid;
begin
  select invite_code into v_code
  from private.special_referral_pending
  where email=lower(trim(new.email)) and created_at>now()-interval '24 hours'
  limit 1;
  if v_code is null then return new; end if;

  select referrer_user_id into v_referrer
  from public.special_referral_rules
  where upper(invite_code)=upper(v_code) and active=true
  limit 1;

  if v_referrer is not null and v_referrer<>new.id then
    insert into public.special_referral_signups(referred_user_id,referrer_user_id,invite_code)
    values(new.id,v_referrer,upper(v_code))
    on conflict (referred_user_id) do nothing;
  end if;

  delete from private.special_referral_pending where email=lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists consume_special_referral_pending_trigger on public.profiles;
create trigger consume_special_referral_pending_trigger
after insert on public.profiles
for each row execute function private.consume_special_referral_pending();

create or replace function private.award_special_referral(
  p_referred_user_id uuid,p_source_type text,p_source_id uuid,p_source_amount numeric
) returns boolean
language plpgsql security definer set search_path=''
as $$
declare v_referrer uuid; v_rate numeric(6,2); v_reward numeric(18,2); v_reward_id uuid;
begin
  if p_source_type not in ('deposit','purchase') or p_source_amount is null or p_source_amount<=0 then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_referred_user_id::text)::bigint);

  if exists (select 1 from public.special_referral_rewards where referred_user_id=p_referred_user_id) then
    return false;
  end if;

  select s.referrer_user_id,r.reward_percent into v_referrer,v_rate
  from public.special_referral_signups s
  join public.special_referral_rules r
    on r.referrer_user_id=s.referrer_user_id and upper(r.invite_code)=upper(s.invite_code)
  where s.referred_user_id=p_referred_user_id and r.active=true
  limit 1;

  if v_referrer is null or v_referrer=p_referred_user_id then return false; end if;
  v_reward := round(p_source_amount*v_rate/100.0,2);

  insert into public.special_referral_rewards(
    referred_user_id,referrer_user_id,source_type,source_id,source_amount,reward_percent,reward_amount
  ) values(
    p_referred_user_id,v_referrer,p_source_type,p_source_id,round(p_source_amount,2),v_rate,v_reward
  ) returning id into v_reward_id;

  update public.wallets
  set balance=balance+v_reward,total_bonus=total_bonus+v_reward
  where user_id=v_referrer;
  if not found then raise exception 'Carteira do indicador não encontrada'; end if;

  insert into public.transactions(user_id,type,amount,description,status,reference_id)
  values(v_referrer,'bonus',v_reward,'Comissão especial de indicação · 35%','completed',v_reward_id);

  insert into public.notifications(user_id,title,message)
  values(v_referrer,'Comissão de indicação liberada','Sua comissão exclusiva de 35% foi creditada na carteira.');
  return true;
end;
$$;
revoke all on function private.award_special_referral(uuid,text,uuid,numeric) from public,anon,authenticated;

create or replace function private.special_referral_on_deposit()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.status='completed' and old.status is distinct from new.status then
    perform private.award_special_referral(new.user_id,'deposit',new.id,new.amount);
  end if;
  return new;
end;
$$;
drop trigger if exists special_referral_deposit_trigger on public.deposits;
create trigger special_referral_deposit_trigger
after update of status on public.deposits
for each row execute function private.special_referral_on_deposit();

create or replace function private.special_referral_on_purchase()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  perform private.award_special_referral(new.user_id,'purchase',new.id,new.amount_invested);
  return new;
end;
$$;
drop trigger if exists special_referral_purchase_trigger on public.user_projects;
create trigger special_referral_purchase_trigger
after insert on public.user_projects
for each row execute function private.special_referral_on_purchase();

create or replace function public.get_special_referral_summary()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_rule public.special_referral_rules%rowtype;
  v_invited integer; v_qualified integer; v_total numeric(18,2); v_referrals jsonb;
begin
  if v_user_id is null then return null; end if;
  select * into v_rule from public.special_referral_rules
  where referrer_user_id=v_user_id and active=true limit 1;
  if not found then return null; end if;

  select count(*)::integer into v_invited
  from public.special_referral_signups where referrer_user_id=v_user_id;

  select count(*)::integer,coalesce(sum(reward_amount),0)
  into v_qualified,v_total
  from public.special_referral_rewards where referrer_user_id=v_user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'name',p.name,'joinedAt',s.joined_at,
    'qualified',exists(select 1 from public.special_referral_rewards rr where rr.referred_user_id=s.referred_user_id)
  ) order by s.joined_at desc),'[]'::jsonb)
  into v_referrals
  from public.special_referral_signups s
  join public.profiles p on p.id=s.referred_user_id
  where s.referrer_user_id=v_user_id;

  return jsonb_build_object(
    'active',true,'inviteCode',v_rule.invite_code,
    'rewardAmount',0,'rewardPercent',v_rule.reward_percent,'rewardMode','percent',
    'minPurchaseAmount',0,'invitedCount',v_invited,'qualifiedCount',v_qualified,
    'totalBonus',v_total,'referrals',v_referrals
  );
end;
$$;
revoke all on function public.get_special_referral_summary() from public,anon;
grant execute on function public.get_special_referral_summary() to authenticated;

commit;
