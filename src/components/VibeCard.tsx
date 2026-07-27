"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MapPin, Users, Star } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { formatVibeWhen, type InterestStatus } from "@/lib/vibes";
import { formatApproximateVibeLocation } from "@/lib/vibe-location";
import type { VibeDisplayMatch } from "@/lib/vibe-stats";
import { useVibeCardImpression } from "@/components/VibeBehaviorTracker";

export type VibeCardData = {
  id: string;
  title: string;
  category: string;
  categories?: string[] | null;
  photos: string[] | null;
  city: string;
  area: string | null;
  country: string | null;
  starts_at: string;
  timezone?: string | null;
  capacity: number;
  event_vibe_tags: string[] | null;
  host: { display_name: string | null; photos: string[] | null } | null;
};

// Statuses that render a chip on the card (others show none).
const STATUS_CHIP = ["interested", "invited", "confirmed", "standby", "removed"];

// Browse cards are horizontal list rows; Home keeps the existing artwork-first card.
export default function VibeCard({
  vibe,
  confirmedCount,
  myStatus,
  match,
  faded,
  rating,
  canDismiss,
  variant = "browse",
  homeCta,
}: {
  vibe: VibeCardData;
  confirmedCount: number;
  myStatus?: InterestStatus | null;
  match?: VibeDisplayMatch;
  faded?: boolean;
  rating?: number | null;
  canDismiss?: boolean;
  variant?: "browse" | "home";
  homeCta?: { label: string; href: string; tone: "coral" | "green" | "muted" };
}) {
  const supabase = createClient();
  const t = useTranslations("vibes");
  const locale = useLocale();
  const [hidden, setHidden] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const cover = vibe.photos?.[0];
  // Full multi-select; fall back to the single primary category for older vibes.
  const allCategories = (
    vibe.categories && vibe.categories.length > 0 ? vibe.categories : [vibe.category]
  ).filter(Boolean);
  const shownCategories = allCategories.slice(0, 3);
  const extraCategories = allCategories.length - shownCategories.length;
  const hostName = vibe.host?.display_name || t("card.hostFallback");
  const hostAvatar = vibe.host?.photos?.[0];
  const approximateLocation =
    formatApproximateVibeLocation(vibe) || t("card.locationTbd");
  const catLabel = (c: string) => (t.has(`categories.${c}`) ? t(`categories.${c}`) : c);
  const isBrowse = variant === "browse";
  const impressionRef = useVibeCardImpression(
    vibe.id,
    isBrowse ? "browse" : "home",
    !faded && !myStatus
  );

  useEffect(() => {
    if (!hidden) return;
    const timer = window.setTimeout(() => setCollapsed(true), 5000);
    return () => window.clearTimeout(timer);
  }, [hidden]);

  async function markNotForMe() {
    setBusy(true);
    const { error } = await supabase.rpc("mark_vibe_not_for_me", { p_vibe: vibe.id });
    setBusy(false);
    if (!error) {
      setHidden(true);
      setCollapsed(false);
    }
  }

  async function undoNotForMe() {
    setBusy(true);
    const { error } = await supabase.rpc("undo_vibe_not_for_me", { p_vibe: vibe.id });
    setBusy(false);
    if (!error) {
      setHidden(false);
      setCollapsed(false);
    }
  }

  if (collapsed) return null;

  if (hidden) {
    return (
      <div className="flex min-h-28 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink/25 bg-white/70 p-4 text-center">
        <p className="text-sm font-extrabold text-ink">{t("card.hidden")}</p>
        <p className="mt-0.5 text-xs font-medium text-muted">{t("card.hiddenBody")}</p>
        <button
          type="button"
          onClick={undoNotForMe}
          disabled={busy}
          className="mt-1 text-sm font-bold text-flockie-orange underline disabled:opacity-50"
        >
          {t("card.undo")}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={impressionRef}
      className={
        isBrowse
          ? `relative rounded-3xl border border-ink/10 bg-white p-2 shadow-[0_2px_12px_rgba(10,37,69,0.07)] sm:p-2.5 ${
              faded ? "opacity-70" : "transition-transform hover:-translate-y-0.5"
            }`
          : `relative flex flex-col rounded-3xl border border-ink/10 bg-white p-2 shadow-[0_2px_12px_rgba(10,37,69,0.07)] ${
              faded ? "opacity-70" : "transition-transform hover:-translate-y-1"
            }`
      }
    >
      {canDismiss && !faded && !myStatus && (
        <button
          type="button"
          onClick={markNotForMe}
          disabled={busy}
          aria-label={t("card.notForMe")}
          className="absolute right-3.5 top-3.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-base font-black leading-none text-ink shadow-[0_1px_5px_rgba(10,37,69,0.2)] backdrop-blur hover:bg-white disabled:opacity-50"
        >
          ×
        </button>
      )}
      {isBrowse && !faded && myStatus && STATUS_CHIP.includes(myStatus) && (
        <span className="absolute right-3.5 top-3.5 z-10 rounded-full bg-onboarding-green px-2.5 py-1 text-[10px] font-extrabold leading-none text-white shadow-[0_1px_5px_rgba(10,37,69,0.2)]">
          {t(`status.${myStatus}`)}
        </span>
      )}
      <Link
        href={`/vibes/${vibe.id}`}
        className={
          isBrowse ? "flex min-w-0 flex-1 items-stretch sm:flex-col" : "flex flex-1 flex-col"
        }
      >
        <div
          className={
            isBrowse
              ? "relative w-24 shrink-0 overflow-hidden rounded-2xl bg-cream sm:aspect-[16/10] sm:w-full"
              : "relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-cream"
          }
        >
          {cover ? (
            <Image
              src={cover}
              alt=""
              fill
              sizes={isBrowse ? "(max-width:640px) 96px, 112px" : "(max-width:640px) 33vw, 288px"}
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-3xl">🎟️</div>
          )}
          {!isBrowse && !faded && myStatus && STATUS_CHIP.includes(myStatus) && (
            <span className="absolute right-2 top-2 rounded-full bg-onboarding-green px-2 py-0.5 text-[10px] font-extrabold leading-none text-white shadow-[0_1px_5px_rgba(10,37,69,0.2)]">
              {t(`status.${myStatus}`)}
            </span>
          )}
        </div>

        <div
          className={
            isBrowse
              ? "flex min-w-0 flex-1 flex-col justify-center px-2 py-2 pr-10 sm:px-1.5 sm:pb-1 sm:pr-1.5 sm:pt-2.5"
              : "flex flex-1 flex-col px-1.5 pt-2.5 pb-1"
          }
        >
          <p
            className={
              isBrowse
                ? "line-clamp-2 text-base font-extrabold leading-tight text-ink"
                : "line-clamp-2 text-[13px] font-extrabold leading-tight text-ink"
            }
          >
            {vibe.title}
          </p>
          <p
            className={
              isBrowse
                ? "mt-1 text-sm font-bold leading-tight text-flockie-orange"
                : "mt-1 text-[11px] font-bold leading-tight text-flockie-orange"
            }
          >
            {formatVibeWhen(vibe.starts_at, locale, vibe.timezone)}
          </p>
          <p
            className={
              isBrowse
                ? "mt-1 flex items-center gap-1 text-sm font-medium text-muted"
                : "mt-0.5 flex items-center gap-1 text-[11px] font-medium text-muted"
            }
          >
            <MapPin size={isBrowse ? 14 : 11} className="shrink-0" />
            <span className="truncate">{approximateLocation}</span>
          </p>

          {isBrowse && (
            <div className="mt-2 flex items-center gap-2.5">
              {!faded && match?.state === "scored" && typeof match.score === "number" && (
                <span className="shrink-0 rounded-full bg-flockie-blue/15 px-3 py-1.5 text-[13px] font-extrabold leading-none text-flockie-blue">
                  {t("card.match", { pct: match.score })}
                </span>
              )}
              {!faded && match?.state === "new_pick" && (
                <span className="shrink-0 rounded-full bg-cream px-2.5 py-1 text-[11px] font-extrabold leading-none text-muted">
                  {t("card.newPick")}
                </span>
              )}
              {faded && typeof rating === "number" && rating > 0 && (
                <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-cream px-2.5 py-1 text-[11px] font-extrabold leading-none text-ink">
                  <Star size={11} className="fill-flockie-coral text-flockie-coral" /> {rating.toFixed(1)}
                </span>
              )}
            </div>
          )}

          {!isBrowse && (
            <div className="mt-2 flex items-center gap-2.5">
              {!faded && match?.state === "scored" && typeof match.score === "number" && (
                <span className="shrink-0 rounded-full bg-flockie-blue/15 px-2.5 py-1 text-[12px] font-extrabold leading-none text-flockie-blue">
                  {t("card.match", { pct: match.score })}
                </span>
              )}
              {!faded && match?.state === "new_pick" && (
                <span className="shrink-0 rounded-full bg-cream px-2.5 py-1 text-[11px] font-extrabold leading-none text-muted">
                  {t("card.newPick")}
                </span>
              )}
              {faded && typeof rating === "number" && rating > 0 && (
                <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-cream px-2.5 py-1 text-[11px] font-extrabold leading-none text-ink">
                  <Star size={11} className="fill-flockie-coral text-flockie-coral" /> {rating.toFixed(1)}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
      {!isBrowse && homeCta && (
        <Link
          href={homeCta.href}
          className={`mt-2 flex items-center justify-center rounded-xl py-2 text-xs font-extrabold ${
            homeCta.tone === "green"
              ? "bg-onboarding-green text-white"
              : homeCta.tone === "muted"
                ? "border border-ink/15 bg-white text-ink"
                : "bg-flockie-coral text-white"
          }`}
        >
          {homeCta.label}
        </Link>
      )}
    </div>
  );
}
