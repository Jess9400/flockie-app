-- SOCIO TIER (paid club membership, entitlement layer only) - founders' call
-- 2026-08. Modeled on Brazil's socio-torcedor culture: a club can offer a paid
-- monthly tier. V1 moves NO money through Flockie: members pay the host
-- directly (Pix/cash/any link), the HOST marks who paid, and the app enforces
-- the perks - visible badge, socio-only media, lapsed access degrades to free.
-- The rail (PSP split / NowPayments) plugs in later without schema changes.
--
-- Access model: helper + RPCs SECURITY DEFINER, explicit search_path,
-- authenticated-only execute (anon revoked). Marking payments is HOST-only
-- (it is their money); moderators keep day-to-day powers but not this.
-- Requires club-moderators.sql + club-media.sql live. Run in the Supabase SQL
-- editor. Safe to re-run.

-- ── The offer (host-configured; null price = no paid tier) ──────────────────
alter table public.clubs
  add column if not exists socio_price_cents int check (socio_price_cents is null or socio_price_cents >= 0),
  add column if not exists socio_currency text not null default 'BRL' check (char_length(socio_currency) = 3),
  add column if not exists socio_perks text check (char_length(socio_perks) <= 600);

-- ── The entitlement (per member) ────────────────────────────────────────────
alter table public.club_memberships
  add column if not exists tier text not null default 'free' check (tier in ('free', 'paid')),
  add column if not exists paid_until timestamptz;

-- Active socio = paid tier not yet lapsed. Managers always count (the host
-- never pays their own club).
create or replace function public.is_club_socio(p_club uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select public.is_club_manager(p_club)
    or exists (
      select 1 from public.club_memberships
      where club_id = p_club
        and user_id = auth.uid()
        and status in ('founding', 'regular')
        and tier = 'paid'
        and coalesce(paid_until, '-infinity') > now()
    );
$$;
revoke all on function public.is_club_socio(uuid) from public, anon;
grant execute on function public.is_club_socio(uuid) to authenticated;

-- ── Host marks a payment (or revokes the tier) ──────────────────────────────
-- p_months > 0: extend paid_until by that many months (from now, or from the
-- current expiry if still active - early renewals don't lose days).
-- p_months = 0: back to free.
create or replace function public.mark_club_socio(p_club uuid, p_user uuid, p_months int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_title text; v_until timestamptz;
begin
  if not public.is_club_host(p_club) then
    raise exception 'only the club host can record socio payments';
  end if;
  if p_months is null or p_months < 0 or p_months > 24 then
    raise exception 'months must be between 0 and 24';
  end if;

  if p_months = 0 then
    update public.club_memberships
    set tier = 'free', paid_until = null, updated_at = now()
    where club_id = p_club and user_id = p_user and status in ('founding', 'regular');
    if not found then raise exception 'an active club membership is required'; end if;
    return jsonb_build_object('tier', 'free');
  end if;

  update public.club_memberships
  set tier = 'paid',
      paid_until = greatest(coalesce(paid_until, now()), now()) + make_interval(months => p_months),
      updated_at = now()
  where club_id = p_club and user_id = p_user and status in ('founding', 'regular')
  returning paid_until into v_until;
  if not found then raise exception 'an active club membership is required'; end if;

  select title into v_title from public.clubs where id = p_club;
  perform public.notify(
    p_user,
    'club_socio',
    'Your ' || v_title || ' membership is active',
    'Active until ' || to_char(v_until, 'DD Mon YYYY') || '. Thanks for keeping the club alive.',
    jsonb_build_object('href', '/clubs/' || p_club)
  );
  return jsonb_build_object('tier', 'paid', 'paid_until', v_until);
end;
$$;
revoke execute on function public.mark_club_socio(uuid, uuid, int) from public, anon;
grant execute on function public.mark_club_socio(uuid, uuid, int) to authenticated;

-- ── Members see the offer + their own standing (clubs base table is
--    host-read-only, so this definer RPC is the member-safe reader) ──────────
create or replace function public.club_socio_offer(p_club uuid)
returns table (price_cents int, currency text, perks text, my_tier text, my_paid_until timestamptz)
language sql security definer set search_path = public stable as $$
  select c.socio_price_cents, c.socio_currency, c.socio_perks,
         coalesce(m.tier, 'free'), m.paid_until
  from public.clubs c
  left join public.club_memberships m
    on m.club_id = c.id and m.user_id = auth.uid()
  where c.id = p_club
    and (public.is_club_member(p_club) or public.is_club_host(p_club));
$$;
revoke all on function public.club_socio_offer(uuid) from public, anon;
grant execute on function public.club_socio_offer(uuid) to authenticated;

-- ── Socio-only media: flag + read gating ────────────────────────────────────
alter table public.club_media
  add column if not exists paid_only boolean not null default false;

drop policy if exists "club media member read" on public.club_media;
create policy "club media member read" on public.club_media for select to authenticated
  using (
    public.is_club_manager(club_id)
    or (public.is_club_member(club_id) and (not paid_only or public.is_club_socio(club_id)))
  );
