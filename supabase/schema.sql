-- Run once in Supabase SQL Editor. Then follow README to allow your admin user.
create table public.photographers (id uuid primary key references auth.users(id) on delete cascade);
alter table public.photographers enable row level security;
create policy "Read own admin membership" on public.photographers for select to authenticated using (id = auth.uid());
create function public.is_photographer() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.photographers where id = auth.uid());
$$;
revoke all on function public.is_photographer() from public;
grant execute on function public.is_photographer() to authenticated;

create table public.events (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  token uuid not null unique,
  name text not null check (length(name) between 1 and 120),
  date date not null,
  location text not null default '' check (length(location) <= 160),
  category text not null default 'Wedding' check (category in ('Wedding','Celebration','Corporate','Portraits','Other')),
  status text not null default 'draft' check (status in ('draft','live','archived')),
  cover text not null default '',
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);
create table public.photos (
  id uuid primary key,
  event_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  path text not null unique,
  imagekit_file_id text not null unique,
  size bigint not null check (size > 0),
  face_count integer not null check (face_count between 0 and 50),
  descriptors jsonb not null default '[]' check (jsonb_typeof(descriptors) = 'array' and jsonb_array_length(descriptors) <= 50),
  created_at timestamptz not null default now(),
  foreign key (event_id, owner_id) references public.events(id, owner_id) on delete cascade,
  check (path like owner_id::text || '/' || event_id::text || '/%')
);
create index photos_event_idx on public.photos(event_id);
alter table public.events enable row level security;
alter table public.photos enable row level security;
create policy "Owner events" on public.events for all to authenticated using (owner_id = auth.uid() and public.is_photographer()) with check (owner_id = auth.uid() and public.is_photographer());
-- Writes must go through the server, which verifies ImageKit file ownership/privacy.
create policy "Read owner photos" on public.photos for select to authenticated using (owner_id = auth.uid() and public.is_photographer());
-- Keep this MVP's matching work bounded. A background vector pipeline is needed beyond this.
create function public.enforce_event_photo_limit() returns trigger language plpgsql set search_path = '' as $$
begin
  perform 1 from public.events where id = new.event_id for update;
  if (select count(*) from public.photos where event_id = new.event_id) >= 2000 then
    raise exception 'This demo supports up to 2,000 photos per event.';
  end if;
  return new;
end;
$$;
create trigger enforce_photo_limit before insert on public.photos for each row execute function public.enforce_event_photo_limit();

-- Images are stored in ImageKit, not in Supabase Storage.

-- Atomic, persistent rate limiting across serverless instances; callable only on the server.
create table public.match_limits (key text primary key, window_start timestamptz not null, attempts integer not null);
alter table public.match_limits enable row level security;
create function public.take_match_slot(p_key text) returns boolean language plpgsql security definer set search_path = '' as $$
declare attempts_now integer;
begin
  delete from public.match_limits where window_start < now() - interval '1 day';
  insert into public.match_limits as limits (key,window_start,attempts) values (p_key,now(),1)
  on conflict(key) do update set
    attempts = case when limits.window_start < now() - interval '10 minutes' then 1 else limits.attempts + 1 end,
    window_start = case when limits.window_start < now() - interval '10 minutes' then now() else limits.window_start end
  returning attempts into attempts_now;
  return attempts_now <= 20;
end;
$$;
revoke all on function public.take_match_slot(text) from public, anon, authenticated;
grant execute on function public.take_match_slot(text) to service_role;
alter publication supabase_realtime add table public.events, public.photos;
