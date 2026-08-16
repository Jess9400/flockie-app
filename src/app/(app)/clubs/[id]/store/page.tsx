import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import ClubStoreFront, { type StoreProduct, type MyOrder } from "@/components/ClubStoreFront";
import ClubStoreManager, { type StoreOrder } from "@/components/ClubStoreManager";

// Club store: host lists merchandise, members order, host confirms payment
// and delivery (v1 rail-agnostic - see supabase/club-store.sql).
export default async function ClubStorePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const user = await getSessionUser();
  const t = await getTranslations("clubs.store");

  const { data } = await supabase.rpc("club_detail", { p_club: params.id }).maybeSingle();
  const club = data as { id: string; title: string; is_host: boolean; membership_status: string | null } | null;
  if (!club) redirect("/clubs");
  const isMember = club.is_host || ["founding", "regular"].includes(club.membership_status ?? "");
  if (!isMember) redirect(`/clubs/${params.id}`);

  const { data: productRows } = await supabase
    .from("club_products")
    .select("id, title, description, photo, price_cents, currency, active")
    .eq("club_id", club.id)
    .order("created_at", { ascending: false });
  const products = (productRows ?? []) as (StoreProduct & { active: boolean })[];
  const titleById = new Map(products.map((p) => [p.id, p.title]));

  let hostOrders: StoreOrder[] = [];
  let myOrders: MyOrder[] = [];
  if (club.is_host) {
    const { data: orderRows } = await supabase
      .from("club_orders")
      .select("id, product_id, buyer_id, status, price_cents, currency")
      .eq("club_id", club.id)
      .order("created_at", { ascending: false })
      .limit(100);
    const buyerIds = Array.from(new Set((orderRows ?? []).map((o) => o.buyer_id)));
    const { data: buyers } = buyerIds.length
      ? await supabase.from("public_profiles").select("id, display_name").in("id", buyerIds)
      : { data: [] };
    const nameById = new Map((buyers ?? []).map((b) => [b.id, b.display_name]));
    hostOrders = (orderRows ?? []).map((o) => ({
      id: o.id,
      product_title: titleById.get(o.product_id) ?? t("productFallback"),
      buyer_name: nameById.get(o.buyer_id) ?? null,
      status: o.status,
      price_cents: o.price_cents,
      currency: o.currency,
    }));
  } else {
    const { data: orderRows } = await supabase
      .from("club_orders")
      .select("id, product_id, status, price_cents, currency")
      .eq("club_id", club.id)
      .eq("buyer_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(50);
    myOrders = (orderRows ?? []).map((o) => ({
      id: o.id,
      product_title: titleById.get(o.product_id) ?? t("productFallback"),
      status: o.status,
      price_cents: o.price_cents,
      currency: o.currency,
    }));
  }

  return (
    <main className="mx-auto max-w-2xl px-5 pb-10 pt-6">
      <Link
        href={`/clubs/${club.id}`}
        className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink"
      >
        <ChevronLeft size={16} /> {club.title}
      </Link>
      <h1 className="mt-4 text-2xl font-black text-ink">🛍️ {t("title")}</h1>
      <p className="mt-1 text-sm font-medium text-muted">
        {club.is_host ? t("subtitleHost") : t("subtitleMember")}
      </p>

      {club.is_host ? (
        <ClubStoreManager clubId={club.id} userId={user!.id} products={products} orders={hostOrders} />
      ) : (
        <ClubStoreFront products={products.filter((p) => p.active)} myOrders={myOrders} />
      )}
    </main>
  );
}
