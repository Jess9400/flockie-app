"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import type { StoreProduct } from "@/components/ClubStoreFront";

export type StoreOrder = {
  id: string;
  product_title: string;
  buyer_name: string | null;
  status: string;
  price_cents: number;
  currency: string;
};

const fmt = (cents: number, currency: string) => `${currency} ${(cents / 100).toFixed(2)}`;

// Host side of the club store: product CRUD + the orders inbox. Confirming
// 'paid' is manual in v1 (rail-agnostic); the PSP webhook will do it later.
export default function ClubStoreManager({
  clubId,
  userId,
  products,
  orders,
}: {
  clubId: string;
  userId: string;
  products: (StoreProduct & { active: boolean })[];
  orders: StoreOrder[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("clubs.store");
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    setBusy("photo");
    const path = `${userId}/store-${crypto.randomUUID()}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    setBusy(null);
    if (error) return setMsg(error.message);
    setPhoto(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
  }

  async function addProduct() {
    const cents = Math.round(Number(price.replace(",", ".")) * 100);
    if (!title.trim() || !Number.isFinite(cents) || cents <= 0) return setMsg(t("errProduct"));
    setBusy("add");
    setMsg(null);
    const { error } = await supabase.from("club_products").insert({
      club_id: clubId,
      title: title.trim(),
      description: description.trim() || null,
      photo,
      price_cents: cents,
      currency: currency.toUpperCase().slice(0, 3),
    });
    setBusy(null);
    if (error) return setMsg(error.message);
    setTitle("");
    setDescription("");
    setPrice("");
    setPhoto(null);
    if (fileRef.current) fileRef.current.value = "";
    setMsg(t("productAdded"));
    router.refresh();
  }

  async function toggleActive(product: StoreProduct & { active: boolean }) {
    setBusy(product.id);
    const { error } = await supabase
      .from("club_products")
      .update({ active: !product.active })
      .eq("id", product.id);
    setBusy(null);
    if (error) return setMsg(error.message);
    router.refresh();
  }

  async function setStatus(orderId: string, status: "paid" | "delivered" | "cancelled") {
    setBusy(orderId);
    setMsg(null);
    const { error } = await supabase.rpc("set_club_order_status", { p_order: orderId, p_status: status });
    setBusy(null);
    if (error) return setMsg(error.message);
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-3xl border border-ink/15 bg-white p-5 shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
        <h2 className="text-lg font-black text-ink">{t("addProduct")}</h2>
        <div className="mt-3 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder={t("productTitle")}
            className="w-full rounded-xl border border-ink/25 px-3 py-2 font-medium outline-none"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder={t("productDescription")}
            className="w-full resize-y rounded-xl border border-ink/25 px-3 py-2 font-medium outline-none"
          />
          <div className="grid grid-cols-[1fr_5rem_auto] items-center gap-2">
            <input
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={t("productPrice")}
              className="rounded-xl border border-ink/25 px-3 py-2 font-medium outline-none"
            />
            <input
              value={currency}
              maxLength={3}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className="rounded-xl border border-ink/25 px-3 py-2 text-center font-medium uppercase outline-none"
            />
            <label className="cursor-pointer rounded-full border border-ink/15 bg-white px-3 py-2 text-xs font-bold text-ink">
              {photo ? t("photoReady") : t("addPhoto")}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => uploadPhoto(e.target.files?.[0])}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={addProduct}
            disabled={busy === "add" || busy === "photo"}
            className="w-full rounded-full border border-ink/15 bg-flockie-blue py-2.5 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:opacity-50"
          >
            {t("saveProduct")}
          </button>
        </div>

        {products.length > 0 && (
          <div className="mt-4 space-y-2 border-t-2 border-ink/10 pt-3">
            {products.map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-3 rounded-2xl bg-cream p-2">
                <div className="flex min-w-0 items-center gap-2">
                  {product.photo ? (
                    <Image src={product.photo} alt="" width={36} height={36} className="h-9 w-9 rounded-xl object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg">🛍️</span>
                  )}
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-extrabold ${product.active ? "text-ink" : "text-ink/40 line-through"}`}>
                      {product.title}
                    </p>
                    <p className="text-xs font-bold text-muted">{fmt(product.price_cents, product.currency)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleActive(product)}
                  disabled={busy === product.id}
                  className="shrink-0 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-50"
                >
                  {product.active ? t("deactivate") : t("activate")}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-ink/15 bg-white p-5 shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
        <h2 className="text-lg font-black text-ink">{t("ordersHeading")}</h2>
        {orders.length === 0 ? (
          <p className="mt-2 text-sm font-medium text-muted">{t("noOrders")}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {orders.map((order) => (
              <div key={order.id} className="rounded-2xl bg-cream p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-ink">
                      {order.product_title} · {order.buyer_name ?? t("buyerFallback")}
                    </p>
                    <p className="text-xs font-bold text-muted">
                      {fmt(order.price_cents, order.currency)} · {t(`status_${order.status}`)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {order.status === "pending" && (
                      <>
                        <button type="button" onClick={() => setStatus(order.id, "paid")} disabled={busy === order.id}
                          className="rounded-full bg-flockie-orange px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                          {t("markPaid")}
                        </button>
                        <button type="button" onClick={() => setStatus(order.id, "cancelled")} disabled={busy === order.id}
                          className="rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-50">
                          {t("cancel")}
                        </button>
                      </>
                    )}
                    {order.status === "paid" && (
                      <button type="button" onClick={() => setStatus(order.id, "delivered")} disabled={busy === order.id}
                        className="rounded-full bg-flockie-blue px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                        {t("markDelivered")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      {msg && <p className="text-sm font-bold text-flockie-blue">{msg}</p>}
    </div>
  );
}
