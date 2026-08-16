-- CLUB STORE (merchandise) - founders' call 2026-08. Each club gets a little
-- store: host lists products (kits, shirts, prints), members order. V1 is the
-- same rail-agnostic pattern as the Socio tier: an order starts 'pending',
-- the member pays the host through whatever rail is wired (card checkout when
-- the PSP lands; direct until then), the host confirms 'paid' and later
-- 'delivered'. Prices carry their own currency per product. No funds move
-- through Flockie in this release.
--
-- Access model: tables RLS-scoped (members read active products; buyers and
-- managers read orders); writes only via SECURITY DEFINER RPCs with explicit
-- search_path, authenticated-only execute, anon revoked. Requires
-- clubs-foundation.sql + club-moderators.sql. Run in the Supabase SQL editor.
-- Safe to re-run.

-- ── Products ────────────────────────────────────────────────────────────────
create table if not exists public.club_products (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 80),
  description text check (char_length(description) <= 300),
  photo text,
  price_cents int not null check (price_cents > 0),
  currency text not null default 'BRL' check (char_length(currency) = 3),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists club_products_club_idx on public.club_products (club_id, active, created_at desc);
alter table public.club_products enable row level security;

drop policy if exists "club products member read" on public.club_products;
create policy "club products member read" on public.club_products for select to authenticated
  using (public.is_club_manager(club_id) or (active and public.is_club_member(club_id)));

drop policy if exists "club products host write" on public.club_products;
create policy "club products host write" on public.club_products for all to authenticated
  using (public.is_club_host(club_id)) with check (public.is_club_host(club_id));

-- ── Orders ──────────────────────────────────────────────────────────────────
create table if not exists public.club_orders (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  product_id uuid not null references public.club_products(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'delivered', 'cancelled')),
  price_cents int not null,
  currency text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists club_orders_club_idx on public.club_orders (club_id, status, created_at desc);
create index if not exists club_orders_buyer_idx on public.club_orders (buyer_id, created_at desc);
alter table public.club_orders enable row level security;

drop policy if exists "club orders buyer or manager read" on public.club_orders;
create policy "club orders buyer or manager read" on public.club_orders for select to authenticated
  using (buyer_id = auth.uid() or public.is_club_manager(club_id));
-- No direct insert/update policies: writes go through the RPCs below.

-- ── Member places an order (price snapshotted at order time) ────────────────
create or replace function public.place_club_order(p_product uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare pr public.club_products; v_order uuid; v_host uuid; v_buyer text;
begin
  select * into pr from public.club_products where id = p_product;
  if pr.id is null or not pr.active then raise exception 'product not available'; end if;
  if not (public.is_club_member(pr.club_id) or public.is_club_host(pr.club_id)) then
    raise exception 'club members only';
  end if;

  insert into public.club_orders (club_id, product_id, buyer_id, price_cents, currency)
  values (pr.club_id, p_product, auth.uid(), pr.price_cents, pr.currency)
  returning id into v_order;

  select owner_id into v_host from public.clubs where id = pr.club_id;
  v_buyer := coalesce((select display_name from public.profiles where id = auth.uid()), 'Someone');
  perform public.notify(v_host, 'club_order',
    'New order: ' || pr.title,
    v_buyer || ' wants ' || pr.title || '. Confirm the payment on the club store to complete it.',
    jsonb_build_object('href', '/clubs/' || pr.club_id || '/store'));
  return jsonb_build_object('order_id', v_order);
end;
$$;
revoke execute on function public.place_club_order(uuid) from public, anon;
grant execute on function public.place_club_order(uuid) to authenticated;

-- ── Host moves an order along (paid -> delivered, or cancels) ───────────────
create or replace function public.set_club_order_status(p_order uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
declare o public.club_orders; v_title text;
begin
  select * into o from public.club_orders where id = p_order;
  if o.id is null then raise exception 'order not found'; end if;
  if not public.is_club_host(o.club_id) then
    raise exception 'only the club host can update orders';
  end if;
  if p_status not in ('paid', 'delivered', 'cancelled') then
    raise exception 'invalid status';
  end if;

  update public.club_orders set status = p_status, updated_at = now() where id = p_order;

  select title into v_title from public.club_products where id = o.product_id;
  perform public.notify(o.buyer_id, 'club_order_update',
    (case p_status
       when 'paid' then 'Payment confirmed: '
       when 'delivered' then 'Delivered: '
       else 'Order cancelled: ' end) || coalesce(v_title, 'your order'),
    (case p_status
       when 'paid' then 'The host confirmed your payment. They''ll hand it over at the next gathering.'
       when 'delivered' then 'Enjoy! Thanks for supporting the club.'
       else 'This order was cancelled by the host.' end),
    jsonb_build_object('href', '/clubs/' || o.club_id || '/store'));
end;
$$;
revoke execute on function public.set_club_order_status(uuid, text) from public, anon;
grant execute on function public.set_club_order_status(uuid, text) to authenticated;

-- ── Buyer can cancel while still pending ────────────────────────────────────
create or replace function public.cancel_my_club_order(p_order uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.club_orders
  set status = 'cancelled', updated_at = now()
  where id = p_order and buyer_id = auth.uid() and status = 'pending';
  if not found then raise exception 'only your own pending orders can be cancelled'; end if;
end;
$$;
revoke execute on function public.cancel_my_club_order(uuid) from public, anon;
grant execute on function public.cancel_my_club_order(uuid) to authenticated;
