-- Run AFTER schema.sql, once or repeatedly. No photos or users are deleted.
-- Read the current server-controlled metadata, not a stale JWT or user-editable profile.
begin;
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
commit;
