"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type SocioMember = {
  id: string;
  display_name: string | null;
  photo: string | null;
  tier: "free" | "paid";
  paid_until: string | null;
};

// Host-only: configure the paid Socio tier and record who paid. V1 moves no
// money through Flockie - members pay the host directly (Pix/cash/link) and
// the host marks it here; the app enforces the perks (badge, socio-only
// media). See supabase/club-socio-tier.sql.
export default function ClubSocioPanel({
  clubId,
  initialPriceCents,
  initialCurrency,
  initialPerks,
  members,
}: {
  clubId: string;
  initialPriceCents: number | null;
  initialCurrency: string;
  initialPerks: string | null;
  members: SocioMember[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("clubs.socio");
  const [price, setPrice] = useState(
    initialPriceCents != null ? (initialPriceCents / 100).toFixed(2) : ""
  );
  const [currency, setCurrency] = useState(initialCurrency || "BRL");
  const [perks, setPerks] = useState(initialPerks ?? "");
  const [rows, setRows] = useState<Record<string, { tier: string; paid_until: string | null }>>(
    Object.fromEntries(members.map((m) => [m.id, { tier: m.tier, paid_until: m.paid_until }]))
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const offerEnabled = price.trim() !== "";

  async function saveOffer() {
    setBusy("offer");
    setMsg(null);
    const cents = price.trim() === "" ? null : Math.round(Number(price.replace(",", ".")) * 100);
    if (cents != null && (!Number.isFinite(cents) || cents < 0)) {
      setBusy(null);
      return setMsg(t("errPrice"));
    }
    const { error } = await supabase
      .from("clubs")
      .update({
        socio_price_cents: cents,
        socio_currency: currency.toUpperCase().slice(0, 3),
        socio_perks: perks.trim() || null,
      })
      .eq("id", clubId);
    setBusy(null);
    if (error) return setMsg(error.message);
    setMsg(t("offerSaved"));
    router.refresh();
  }

  async function mark(userId: string, months: number) {
    setBusy(userId);
    setMsg(null);
    const { data, error } = await supabase.rpc("mark_club_socio", {
      p_club: clubId,
      p_user: userId,
      p_months: months,
    });
    setBusy(null);
    if (error) return setMsg(error.message);
    const result = data as { tier: string; paid_until?: string };
    setRows((prev) => ({
      ...prev,
      [userId]: { tier: result.tier, paid_until: result.paid_until ?? null },
    }));
    router.refresh();
  }

  const active = (r: { tier: string; paid_until: string | null }) =>
    r.tier === "paid" && !!r.paid_until && new Date(r.paid_until) > new Date();

  return (
    <section className="mt-5 rounded-3xl border border-ink/15 bg-white p-5 shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
      <h2 className="text-lg font-black text-ink">⭐ {t("title")}</h2>
      <p className="mt-0.5 text-sm font-medium text-muted">{t("subtitle")}</p>

      <div className="mt-3 grid grid-cols-[1fr_5rem] gap-2">
        <label className="block text-sm font-bold">
          {t("priceLabel")}
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={t("pricePlaceholder")}
            className="mt-1 w-full rounded-xl border border-ink/25 px-3 py-2 font-medium outline-none"
          />
        </label>
        <label className="block text-sm font-bold">
          {t("currencyLabel")}
          <input
            value={currency}
            maxLength={3}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            className="mt-1 w-full rounded-xl border border-ink/25 px-3 py-2 text-center font-medium uppercase outline-none"
          />
        </label>
      </div>
      <label className="mt-2 block text-sm font-bold">
        {t("perksLabel")}
        <textarea
          value={perks}
          onChange={(e) => setPerks(e.target.value)}
          maxLength={600}
          rows={3}
          placeholder={t("perksPlaceholder")}
          className="mt-1 w-full resize-y rounded-xl border border-ink/25 px-3 py-2 font-medium outline-none"
        />
      </label>
      <button
        type="button"
        onClick={saveOffer}
        disabled={busy === "offer"}
        className="mt-2 w-full rounded-full border border-ink/15 bg-white py-2.5 font-bold text-ink shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:opacity-50"
      >
        {t("saveOffer")}
      </button>

      {offerEnabled && members.length > 0 && (
        <div className="mt-4 space-y-2 border-t-2 border-ink/10 pt-4">
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{t("membersHeading")}</p>
          {members.map((member) => {
            const row = rows[member.id] ?? { tier: member.tier, paid_until: member.paid_until };
            const isActive = active(row);
            return (
              <div key={member.id} className="flex items-center justify-between gap-3 rounded-2xl bg-cream p-2">
                <div className="flex min-w-0 items-center gap-2">
                  {member.photo ? (
                    <Image src={member.photo} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-flockie-blue text-xs font-bold text-white">
                      {(member.display_name || "F")[0]}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold">{member.display_name || t("memberFallback")}</p>
                    <p className="text-[11px] font-bold text-muted">
                      {isActive
                        ? t("activeUntil", {
                            date: new Date(row.paid_until!).toLocaleDateString(),
                          })
                        : t("freeTier")}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => mark(member.id, 1)}
                    disabled={busy === member.id}
                    className="rounded-full border border-ink/15 bg-flockie-orange px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {isActive ? t("extendMonth") : t("markPaid")}
                  </button>
                  {row.tier === "paid" && (
                    <button
                      type="button"
                      onClick={() => mark(member.id, 0)}
                      disabled={busy === member.id}
                      className="rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-50"
                    >
                      {t("setFree")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {msg && <p className="mt-2 text-sm font-bold text-flockie-blue">{msg}</p>}
    </section>
  );
}
