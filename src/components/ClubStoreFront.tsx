"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import PayButton from "@/components/PayButton";

export type StoreProduct = {
  id: string;
  title: string;
  description: string | null;
  photo: string | null;
  price_cents: number;
  currency: string;
};

export type MyOrder = {
  id: string;
  product_title: string;
  status: string;
  price_cents: number;
  currency: string;
};

const fmt = (cents: number, currency: string) => `${currency} ${(cents / 100).toFixed(2)}`;

// Member storefront: order = intent; the host confirms payment (v1 rail-
// agnostic - card checkout replaces the manual step when the PSP lands).
export default function ClubStoreFront({
  clubId,
  products,
  myOrders,
  paymentsEnabled,
}: {
  clubId: string;
  products: StoreProduct[];
  myOrders: MyOrder[];
  paymentsEnabled: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("clubs.store");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function buy(productId: string) {
    setBusy(productId);
    setMsg(null);
    const { error } = await supabase.rpc("place_club_order", { p_product: productId });
    setBusy(null);
    if (error) return setMsg(error.message);
    setMsg(t("orderPlaced"));
    router.refresh();
  }

  async function cancel(orderId: string) {
    setBusy(orderId);
    setMsg(null);
    const { error } = await supabase.rpc("cancel_my_club_order", { p_order: orderId });
    setBusy(null);
    if (error) return setMsg(error.message);
    router.refresh();
  }

  return (
    <div>
      {products.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-cream p-4 text-sm font-medium text-muted">{t("emptyMember")}</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {products.map((product) => (
            <div key={product.id} className="flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white">
              {product.photo ? (
                <Image src={product.photo} alt="" width={300} height={200} className="h-28 w-full object-cover" />
              ) : (
                <div className="flex h-28 w-full items-center justify-center bg-cream text-3xl">🛍️</div>
              )}
              <div className="flex flex-1 flex-col p-3">
                <p className="text-sm font-extrabold text-ink">{product.title}</p>
                {product.description && (
                  <p className="mt-0.5 line-clamp-2 text-xs font-medium text-muted">{product.description}</p>
                )}
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="text-sm font-black text-ink">{fmt(product.price_cents, product.currency)}</span>
                  <button
                    type="button"
                    onClick={() => buy(product.id)}
                    disabled={busy === product.id}
                    className="rounded-full border border-ink/15 bg-flockie-orange px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {t("buy")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {msg && <p className="mt-3 text-sm font-bold text-flockie-blue">{msg}</p>}

      {myOrders.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted">{t("myOrders")}</h2>
          <div className="mt-2 space-y-2">
            {myOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between gap-3 rounded-2xl bg-cream p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-ink">{order.product_title}</p>
                  <p className="text-xs font-bold text-muted">
                    {fmt(order.price_cents, order.currency)} · {t(`status_${order.status}`)}
                  </p>
                </div>
                {order.status === "pending" && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    {paymentsEnabled && <PayButton kind="order" clubId={clubId} orderId={order.id} />}
                    <button
                      type="button"
                      onClick={() => cancel(order.id)}
                      disabled={busy === order.id}
                      className="rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-50"
                    >
                      {t("cancel")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs font-medium text-muted">{t("payHint")}</p>
        </section>
      )}
    </div>
  );
}
