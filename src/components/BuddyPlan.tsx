"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, X } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import PlaceField from "@/components/PlaceField";

export type BuddyPlanData = {
  id: string;
  proposed_by: string;
  category: string;
  place_name: string | null;
  place_url: string | null;
  when_at: string | null;
  status: "proposed" | "accepted" | "declined";
  met: boolean | null;
  created_at: string;
};

const CATS = [
  { key: "coffee", emoji: "☕", q: "coffee shops" },
  { key: "restaurant", emoji: "🍽️", q: "restaurants" },
  { key: "bar", emoji: "🍸", q: "bars" },
  { key: "park", emoji: "🌳", q: "parks" },
  { key: "activity", emoji: "🎾", q: "things to do" },
] as const;

const mapsSearch = (q: string, city?: string | null) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(city ? `${q} near ${city}` : q)}`;

// ~5 days after the plan (or after it was proposed if no time was set) we ask if
// they actually met, then offer the review.
const MET_AFTER_MS = 5 * 24 * 3600 * 1000;

export default function BuddyPlan({
  chatId,
  otherId,
  otherName,
  city,
  currentUserId,
  initialPlan,
}: {
  chatId: string;
  otherId: string;
  otherName: string;
  city?: string | null;
  currentUserId: string;
  initialPlan: BuddyPlanData | null;
}) {
  const t = useTranslations("buddies");
  const locale = useLocale();
  const supabase = createClient();
  const router = useRouter();

  const [plan, setPlan] = useState<BuddyPlanData | null>(initialPlan);
  const [composing, setComposing] = useState(false);
  const [cat, setCat] = useState<(typeof CATS)[number]["key"] | null>(null);
  const [placeName, setPlaceName] = useState("");
  const [placeUrl, setPlaceUrl] = useState<string | null>(null);
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  const catMeta = (key: string) => CATS.find((c) => c.key === key);
  const catLabel = (key: string) => t(`plan.cat.${key}`);
  const fmtWhen = (iso: string) =>
    now == null
      ? ""
      : new Intl.DateTimeFormat(locale, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(iso));

  async function propose() {
    if (!cat || busy) return;
    setBusy(true);
    const trimmed = placeName.trim();
    const url = trimmed ? placeUrl ?? mapsSearch(trimmed, city) : null;
    const { data, error } = await supabase.rpc("propose_buddy_plan", {
      p_chat: chatId,
      p_category: cat,
      p_place_name: trimmed || null,
      p_place_url: url,
      p_when: when ? new Date(when).toISOString() : null,
    });
    setBusy(false);
    if (!error) {
      setPlan({
        id: data as string,
        proposed_by: currentUserId,
        category: cat,
        place_name: trimmed || null,
        place_url: url,
        when_at: when ? new Date(when).toISOString() : null,
        status: "proposed",
        met: null,
        created_at: new Date().toISOString(),
      });
      setComposing(false);
      setCat(null);
      setPlaceName("");
      setPlaceUrl(null);
      setWhen("");
      router.refresh();
    }
  }

  async function respond(accept: boolean) {
    if (!plan || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("respond_buddy_plan", { p_plan: plan.id, p_accept: accept });
    setBusy(false);
    if (!error) {
      setPlan(accept ? { ...plan, status: "accepted" } : null);
      router.refresh();
    }
  }

  async function setMet(met: boolean) {
    if (!plan || busy) return;
    setBusy(true);
    await supabase.rpc("set_plan_met", { p_plan: plan.id, p_met: met });
    setBusy(false);
    setPlan({ ...plan, met });
    if (met) router.push(`/review/${otherId}`);
    else router.refresh();
  }

  // ── Did you meet? (accepted plan, 5+ days past its time, not yet answered) ──
  const askMet =
    plan?.status === "accepted" &&
    plan.met == null &&
    now != null &&
    now - new Date(plan.when_at ?? plan.created_at).getTime() > MET_AFTER_MS;

  const box = "shrink-0 rounded-2xl border border-ink/12 bg-white p-3 shadow-[0_2px_10px_rgba(10,37,69,0.06)]";

  if (askMet && plan) {
    return (
      <div className={`mt-2 ${box}`}>
        <p className="text-sm font-extrabold text-ink">{t("plan.metTitle", { name: otherName })}</p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => setMet(true)}
            disabled={busy}
            className="flex-1 rounded-xl border-2 border-ink bg-flockie-orange py-2 text-sm font-bold text-white shadow-[0_2px_0_0_#E0512C] disabled:opacity-50"
          >
            {t("plan.metYes")}
          </button>
          <button
            onClick={() => setMet(false)}
            disabled={busy}
            className="flex-1 rounded-xl border border-ink/15 bg-white py-2 text-sm font-bold text-ink disabled:opacity-50"
          >
            {t("plan.metNo")}
          </button>
        </div>
      </div>
    );
  }

  // ── Accepted plan — pinned summary ──
  if (plan?.status === "accepted") {
    return (
      <div className={`mt-2 flex items-center gap-3 ${box} border-onboarding-green/40 bg-[#E9F6F1]`}>
        <span className="text-xl">{catMeta(plan.category)?.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-ink">
            {t("plan.onTitle", { category: catLabel(plan.category) })}
          </p>
          <p className="truncate text-xs font-medium text-ink/70">
            {[plan.place_name, plan.when_at ? fmtWhen(plan.when_at) : null].filter(Boolean).join(" · ") ||
              t("plan.tapToChat")}
          </p>
        </div>
        <button onClick={() => setComposing(true)} className="shrink-0 text-xs font-bold text-flockie-blue">
          {t("plan.change")}
        </button>
      </div>
    );
  }

  // ── Proposed plan — waiting (proposer) or accept/decline (recipient) ──
  if (plan?.status === "proposed" && !composing) {
    const mine = plan.proposed_by === currentUserId;
    const details = [plan.place_name, plan.when_at ? fmtWhen(plan.when_at) : null]
      .filter(Boolean)
      .join(" · ");
    return (
      <div className={`mt-2 ${box} border-flockie-coral/40`}>
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-flockie-coral">
          {mine ? t("plan.inviteSent") : t("plan.inviteEyebrow", { name: otherName })}
        </p>
        <div className="mt-1.5 flex items-center gap-2.5">
          <span className="text-2xl">{catMeta(plan.category)?.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-extrabold text-ink">{catLabel(plan.category)}</p>
            <p className="truncate text-xs font-medium text-ink/70">
              {details || t("plan.noDetailsYet")}
            </p>
          </div>
        </div>
        {mine ? (
          <p className="mt-2 text-xs font-medium text-muted">{t("plan.waiting", { name: otherName })}</p>
        ) : (
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={() => respond(true)}
              disabled={busy}
              className="flex-1 rounded-xl border-2 border-ink bg-flockie-orange py-2.5 text-sm font-bold text-white shadow-[0_2px_0_0_#E0512C] disabled:opacity-50"
            >
              {t("plan.accept")}
            </button>
            <button
              onClick={() => respond(false)}
              disabled={busy}
              className="rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm font-bold text-ink disabled:opacity-50"
            >
              {t("plan.decline")}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Composer ──
  if (composing) {
    return (
      <div className={`mt-2 ${box}`}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-extrabold text-ink">{t("plan.proposeTitle")}</p>
          <button onClick={() => setComposing(false)} aria-label={t("shared.close")} className="text-ink/50 hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CATS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCat(c.key)}
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                cat === c.key ? "bg-flockie-coral text-white" : "bg-cream text-ink/70 hover:text-ink"
              }`}
            >
              {c.emoji} {catLabel(c.key)}
            </button>
          ))}
        </div>
        {cat && (
          <div className="mt-2">
            <PlaceField
              category={cat}
              city={city ?? null}
              value={placeName}
              onChange={({ name, url }) => {
                setPlaceName(name);
                setPlaceUrl(url);
              }}
              browseHref={mapsSearch(catMeta(cat)!.q, city)}
              browseLabel={t("plan.browse", { category: catLabel(cat) })}
              placeholder={t("plan.placePlaceholder")}
            />
          </div>
        )}
        <label className="mt-2 flex items-center gap-2 rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm font-medium text-ink/70">
          <CalendarClock size={15} className="shrink-0" />
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="w-full bg-transparent outline-none"
          />
        </label>
        <button
          onClick={propose}
          disabled={!cat || busy}
          className="mt-2 w-full rounded-xl border-2 border-ink bg-flockie-orange py-2 text-sm font-bold text-white shadow-[0_2px_0_0_#E0512C] disabled:opacity-50"
        >
          {t("plan.send")}
        </button>
      </div>
    );
  }

  // ── Default: nudge to propose ──
  return (
    <button
      type="button"
      onClick={() => setComposing(true)}
      className={`mt-2 flex w-full items-center gap-2 ${box} text-left`}
    >
      <span className="text-lg">📅</span>
      <span className="text-sm font-bold text-ink">{t("plan.cta")}</span>
    </button>
  );
}
