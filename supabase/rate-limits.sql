-- Per-user fixed-window rate limiter (no external service needed).
-- Used to cap paid/abuse-prone API routes (AI cover generation, geocoding).
-- Run in the Supabase SQL editor. Safe to re-run.

create table if not exists public.rate_limits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (user_id, bucket, window_start)
);

-- Only the security-definer function below touches this table; no client policies.
alter table public.rate_limits enable row level security;

-- Returns true if the call is allowed, false if the user is over the limit for
-- the current window (or not authenticated). Atomic via upsert.
create or replace function public.rate_limit_hit(p_bucket text, p_max int, p_window_seconds int)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_window timestamptz; v_count int;
begin
  if auth.uid() is null then return false; end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits (user_id, bucket, window_start, count)
  values (auth.uid(), p_bucket, v_window, 1)
  on conflict (user_id, bucket, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_count;
  return v_count <= p_max;
end $$;
grant execute on function public.rate_limit_hit(text, int, int) to authenticated;
