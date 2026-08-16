-- CLUB PAYMENTS FOUNDATION + provider settlement (2026-08-16). One internal
-- payment record per checkout attempt, provider-agnostic: NowPayments (crypto,
-- live first), Asaas (BRL cards, pending platform-account answers), Stripe
-- (USD, waits for the legal entity). The provider deducts the platform fee at
-- its own layer; Flockie only creates checkouts and settles records when the
-- provider's webhook confirms.
--
-- Access model: club_payments has NO direct writes - members create records
-- via create_club_payment (authenticated), the API route attaches the
-- provider invoice via set_club_payment_invoice (authenticated, own row), and
-- ONLY the webhook settles via settle_club_payment, which is granted to
-- service_role EXCLUSIVELY (the IPN route uses the service key after HMAC
-- verification). All SECURITY DEFINER with explicit search_path; anon revoked
-- everywhere. Requires club-socio-tier.sql + club-store.sql. Run in the
-- Supabase SQL editor. Safe to re-run.

create table if not exists public.club_payments (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('socio', 'order')),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.club_orders(id) on delete set null,
  months int check (months is null or months between 1 and 24),
  amount_cents int not null check (amount_cents > 0),
  currency text not null,
  provider text not null check (provider in ('nowpayments', 'asaas', 'stripe')),
  provider_invoice_id text,
  status text not null default 'created'
    check (status in ('created', 'confirmed', 'failed')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create index if not exists club_payments_user_idx on public.club_payments (user_id, created_at desc);
create index if not exists club_payments_club_idx on public.club_payments (club_id, status, created_at desc);
alter table public.club_payments enable row level security;

drop policy if exists "club payments own or host read" on public.club_payments;
create policy "club payments own or host read" on public.club_payments for select to authenticated
  using (user_id = auth.uid() or public.is_club_host(club_id));

-- ── Member starts a checkout (validates intent, snapshots the amount) ───────
create or replace function public.create_club_payment(
  p_kind text, p_club uuid, p_order uuid default null, p_months int default 1, p_provider text default 'nowpayments'
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_amount int; v_currency text; v_payment uuid; o public.club_orders;
begin
  if p_provider not in ('nowpayments', 'asaas', 'stripe') then raise exception 'unknown provider'; end if;

  if p_kind = 'socio' then
    if not (public.is_club_member(p_club) or public.is_club_host(p_club)) then
      raise exception 'club members only';
    end if;
    if p_months is null or p_months < 1 or p_months > 24 then raise exception 'invalid months'; end if;
    select socio_price_cents, socio_currency into v_amount, v_currency
    from public.clubs where id = p_club;
    if v_amount is null then raise exception 'this club has no socio tier'; end if;
    v_amount := v_amount * p_months;
  elsif p_kind = 'order' then
    select * into o from public.club_orders where id = p_order and buyer_id = auth.uid();
    if o.id is null then raise exception 'order not found'; end if;
    if o.status <> 'pending' then raise exception 'order is not awaiting payment'; end if;
    if o.club_id <> p_club then raise exception 'order does not belong to this club'; end if;
    v_amount := o.price_cents; v_currency := o.currency;
  else
    raise exception 'unknown payment kind';
  end if;

  insert into public.club_payments (kind, club_id, user_id, order_id, months, amount_cents, currency, provider)
  values (p_kind, p_club, auth.uid(), p_order, case when p_kind = 'socio' then p_months end, v_amount, v_currency, p_provider)
  returning id into v_payment;

  return jsonb_build_object('payment_id', v_payment, 'amount_cents', v_amount, 'currency', v_currency);
end;
$$;
revoke execute on function public.create_club_payment(text, uuid, uuid, int, text) from public, anon;
grant execute on function public.create_club_payment(text, uuid, uuid, int, text) to authenticated;

-- ── API route attaches the provider's invoice id to the caller's own record ─
create or replace function public.set_club_payment_invoice(p_payment uuid, p_invoice text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.club_payments
  set provider_invoice_id = p_invoice
  where id = p_payment and user_id = auth.uid() and status = 'created';
  if not found then raise exception 'payment not found'; end if;
end;
$$;
revoke execute on function public.set_club_payment_invoice(uuid, text) from public, anon;
grant execute on function public.set_club_payment_invoice(uuid, text) to authenticated;

-- ── Webhook settlement: SERVICE ROLE ONLY (after HMAC verification) ─────────
-- Idempotent: settling an already-settled payment is a no-op. On confirm:
--   socio → tier paid, paid_until extended (keeps remaining days), notify;
--   order → status 'paid', buyer + host notified.
create or replace function public.settle_club_payment(p_payment uuid, p_outcome text, p_provider_ref text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare pay public.club_payments; v_title text; v_until timestamptz; v_host uuid; v_buyer text; v_product text;
begin
  if p_outcome not in ('confirmed', 'failed') then raise exception 'invalid outcome'; end if;
  select * into pay from public.club_payments where id = p_payment for update;
  if pay.id is null then raise exception 'payment not found'; end if;
  if pay.status <> 'created' then return jsonb_build_object('status', pay.status, 'idempotent', true); end if;

  update public.club_payments
  set status = p_outcome,
      confirmed_at = case when p_outcome = 'confirmed' then now() end,
      provider_invoice_id = coalesce(p_provider_ref, provider_invoice_id)
  where id = p_payment;

  if p_outcome = 'failed' then return jsonb_build_object('status', 'failed'); end if;

  select title, owner_id into v_title, v_host from public.clubs where id = pay.club_id;

  if pay.kind = 'socio' then
    update public.club_memberships
    set tier = 'paid',
        paid_until = greatest(coalesce(paid_until, now()), now()) + make_interval(months => coalesce(pay.months, 1)),
        updated_at = now()
    where club_id = pay.club_id and user_id = pay.user_id and status in ('founding', 'regular')
    returning paid_until into v_until;
    perform public.notify(pay.user_id, 'club_socio',
      'Your ' || v_title || ' membership is active',
      'Payment received - your membership is active until ' || to_char(v_until, 'DD Mon YYYY') || '.',
      jsonb_build_object('href', '/clubs/' || pay.club_id));
    perform public.notify(v_host, 'club_socio_payment',
      'New membership payment in ' || v_title,
      coalesce((select display_name from public.profiles where id = pay.user_id), 'A member')
        || ' paid for ' || coalesce(pay.months, 1) || ' month(s).',
      jsonb_build_object('href', '/clubs/' || pay.club_id));
  else
    update public.club_orders set status = 'paid', updated_at = now()
    where id = pay.order_id and status = 'pending';
    select title into v_product from public.club_products where id =
      (select product_id from public.club_orders where id = pay.order_id);
    v_buyer := coalesce((select display_name from public.profiles where id = pay.user_id), 'Someone');
    perform public.notify(pay.user_id, 'club_order_update',
      'Payment confirmed: ' || coalesce(v_product, 'your order'),
      'The club received your payment. Pick it up at the next gathering.',
      jsonb_build_object('href', '/clubs/' || pay.club_id || '/store'));
    perform public.notify(v_host, 'club_order',
      'Order paid: ' || coalesce(v_product, 'a product'),
      v_buyer || ' paid online. Mark it delivered once handed over.',
      jsonb_build_object('href', '/clubs/' || pay.club_id || '/store'));
  end if;

  return jsonb_build_object('status', 'confirmed');
end;
$$;
revoke execute on function public.settle_club_payment(uuid, text, text) from public, anon, authenticated;
grant execute on function public.settle_club_payment(uuid, text, text) to service_role;
