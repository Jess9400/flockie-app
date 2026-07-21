-- Private personal takes on completed Vibes. Run in the Supabase SQL editor.
-- This is intentionally separate from vibe_reviews: a take is profile voice, not
-- event feedback, and it is visible only to its author.
-- Safe to re-run.

create table if not exists public.vibe_takes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vibe_id uuid not null references public.vibes(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, vibe_id)
);

create index if not exists vibe_takes_user_updated_idx
  on public.vibe_takes (user_id, updated_at desc);

alter table public.vibe_takes enable row level security;

drop policy if exists "vibe takes owner select" on public.vibe_takes;
create policy "vibe takes owner select" on public.vibe_takes
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "vibe takes owner delete" on public.vibe_takes;
create policy "vibe takes owner delete" on public.vibe_takes
  for delete to authenticated using (user_id = auth.uid());

-- One take per person per completed Vibe. Hosts can write about their own Vibe;
-- everyone else must have been a confirmed attendee.
create or replace function public.save_vibe_take(p_vibe uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_end timestamptz;
begin
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 280 then
    raise exception 'take must be between 1 and 280 characters';
  end if;

  select coalesce(ends_at, starts_at) into v_end
  from public.vibes
  where id = p_vibe and status <> 'cancelled';

  if v_end is null then
    raise exception 'vibe not found';
  end if;
  if v_end > now() then
    raise exception 'you can add a take once the vibe has ended';
  end if;
  if not exists (
    select 1
    from public.vibes v
    where v.id = p_vibe
      and (
        v.host_id = auth.uid()
        or exists (
          select 1 from public.vibe_interests vi
          where vi.vibe_id = p_vibe
            and vi.user_id = auth.uid()
            and vi.status = 'confirmed'
        )
      )
  ) then
    raise exception 'only the host or confirmed attendees can add a take';
  end if;

  insert into public.vibe_takes (user_id, vibe_id, body)
  values (auth.uid(), p_vibe, btrim(p_body))
  on conflict (user_id, vibe_id)
  do update set body = excluded.body, updated_at = now();
end $$;

revoke all on function public.save_vibe_take(uuid, text) from public, anon;
grant execute on function public.save_vibe_take(uuid, text) to authenticated;
