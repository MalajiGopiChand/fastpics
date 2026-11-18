-- Run after subscriptions.sql. Atomic access changes and recorded manual payments.
begin;
-- Run AFTER schema.sql, once or repeatedly. No photos or users are deleted.
-- Read the current server-controlled metadata, not a stale JWT or user-editable profile.

create or replace function public.is_photographer() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (
  select 1 from auth.users u join public.photographers p on p.id=u.id
  where u.id=auth.uid() and coalesce(u.raw_app_meta_data->>'fastpics_role','')!='owner' and (
   (
    u.raw_app_meta_data->'fastpics_subscription'->>'approved'='true'
    and coalesce(u.raw_app_meta_data->'fastpics_subscription'->>'suspended','false')!='true'
    and (
     (u.raw_app_meta_data->'fastpics_subscription'->>'trial_ends_at')::timestamptz>now()
     or (u.raw_app_meta_data->'fastpics_subscription'->>'paid_until')::timestamptz>now()
    )
   )
  )
 );
$$;
revoke all on function public.is_photographer() from public,anon;
grant execute on function public.is_photographer() to authenticated;
-- Only accounts already provisioned as owner through the server can be bootstrapped.
insert into public.photographers(id)
select id from auth.users where raw_app_meta_data->>'fastpics_role'='owner'
on conflict(id) do nothing;
create or replace function public.fastpics_access_version() returns integer
language sql stable set search_path='' as $$ select 1; $$;
revoke all on function public.fastpics_access_version() from public,anon,authenticated;
grant execute on function public.fastpics_access_version() to service_role;


create table if not exists public.subscription_payments (
 request_id uuid primary key,
 client_id uuid not null references auth.users(id),
 recorded_by uuid not null references auth.users(id),
 amount_inr integer not null check(amount_inr=500),
 created_at timestamptz not null default now(),
 access_until timestamptz not null
);
alter table public.subscription_payments enable row level security;
revoke all on public.subscription_payments from anon,authenticated;
create or replace function public.owner_change_access(p_client uuid,p_actor uuid,p_action text,p_request uuid)
returns void language plpgsql security definer set search_path='' as $$
declare u auth.users%rowtype; plan jsonb; expiry timestamptz;
begin
 if not exists(select 1 from auth.users where id=p_actor and raw_app_meta_data->>'fastpics_role'='owner') then raise exception 'Owner required'; end if;
 select * into u from auth.users where id=p_client for update;
 if not found or u.email_confirmed_at is null or u.raw_app_meta_data->>'fastpics_role'='owner' then raise exception 'Invalid client'; end if;
 plan:=coalesce(u.raw_app_meta_data->'fastpics_subscription','{}'::jsonb);
 if p_action='activate' then
  if p_request is null then raise exception 'Request ID required'; end if;
  if exists(select 1 from public.subscription_payments where request_id=p_request and client_id=p_client) then return; end if;
  expiry:=((greatest(now(),coalesce((plan->>'paid_until')::timestamptz,now())) at time zone 'UTC') + interval '1 month') at time zone 'UTC';
  insert into public.subscription_payments(request_id,client_id,recorded_by,amount_inr,access_until) values(p_request,p_client,p_actor,500,expiry);
  plan:=plan||jsonb_build_object('approved',true,'suspended',false,'paid_until',expiry,'plan','monthly','amount_inr',500);
 elsif p_action='approve' then
  plan:=plan||jsonb_build_object('approved',true,'suspended',false);
  if plan->>'trial_started_at' is null then plan:=plan||jsonb_build_object('trial_started_at',now(),'trial_ends_at',now()+interval '48 hours'); end if;
 elsif p_action='suspend' then plan:=plan||'{"suspended":true}'::jsonb;
 elsif p_action='resume' then plan:=plan||'{"suspended":false}'::jsonb;
 elsif p_action='cancel' then plan:=plan||'{"paid_until":null}'::jsonb;
 else raise exception 'Invalid action'; end if;
 plan:=plan||jsonb_build_object('updated_at',now(),'updated_by',p_actor);
 if plan->>'approved'='true' then insert into public.photographers(id) values(p_client) on conflict(id) do nothing; end if;
 update auth.users set raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||jsonb_build_object('fastpics_subscription',plan),updated_at=now() where id=p_client;
end;
$$;
create or replace function public.owner_metrics() returns jsonb language sql stable security definer set search_path='' as $$
 with clients as (select raw_app_meta_data->'fastpics_subscription' p from auth.users where coalesce(raw_app_meta_data->>'fastpics_role','')!='owner')
 select jsonb_build_object(
 'clients',(select count(*) from clients),
 'pending',(select count(*) from clients where coalesce(p->>'approved','false')!='true'),
 'paid',(select count(*) from clients where p->>'approved'='true' and coalesce(p->>'suspended','false')!='true' and (p->>'paid_until')::timestamptz>now()),
 'trials',(select count(*) from clients where p->>'approved'='true' and coalesce(p->>'suspended','false')!='true' and (p->>'trial_ends_at')::timestamptz>now() and coalesce((p->>'paid_until')::timestamptz,now())<=now()),
 'income',(select coalesce(sum(amount_inr),0) from public.subscription_payments),
 'income_month',(select coalesce(sum(amount_inr),0) from public.subscription_payments where created_at >= (date_trunc('month',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')),
 'photos',(select count(*) from public.photos),
 'bytes',(select coalesce(sum(size),0) from public.photos),
 'logins',(select count(*) from auth.audit_log_entries where payload->>'action'='login')
 );
$$;
create or replace function public.owner_client_usage(p_ids uuid[]) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(t.id::text,jsonb_build_object(
 'photos',(select count(*) from public.photos where owner_id=t.id),
 'bytes',(select coalesce(sum(size),0) from public.photos where owner_id=t.id),
 'logins',(select count(*) from auth.audit_log_entries where payload->>'action'='login' and payload->>'actor_id'=t.id::text)
 )),'{}'::jsonb) from unnest(p_ids) t(id);
$$;
revoke all on function public.owner_change_access(uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.owner_metrics() from public,anon,authenticated;
revoke all on function public.owner_client_usage(uuid[]) from public,anon,authenticated;
grant execute on function public.owner_change_access(uuid,uuid,text,uuid) to service_role;
grant execute on function public.owner_metrics() to service_role;
grant execute on function public.owner_client_usage(uuid[]) to service_role;
commit;
