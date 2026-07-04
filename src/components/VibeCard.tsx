"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MapPin, Users, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { formatVibeWhen, type InterestStatus } from "@/lib/vibes";
import { formatApproximateVibeLocation } from "@/lib/vibe-location";

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
  capacity: number;
  event_vibe_tags: string[] | null;
  host: { display_name: string | null; photos: string[] | null } | null;
};

// Statuses that render a chip on the card (others show none).
const STATUS_CHIP = ["interested", "invited", "confirmed", "standby", "removed"];

// Compact "trading card" — square full-display artwork on top, title + meta below.
// Sized to fill its grid cell (3-up on the Vibes page) or carousel slot on Home.
export default function VibeCard({
  vibe,
  confirmedCount,
  myStatus,
  matchPct,
  faded,
  rating,
  canDismiss,
}: {
  vibe: VibeCardData;
  confirmedCount: number;
  myStatus?: InterestStatus | null;
  matchPct?: number;
  faded?: boolean;
  rating?: number | null;
  canDismiss?: boolean;
}) {
  const supabase = createClient();
  const t = useTranslations("vibes");
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
      className={`relative overflow-hidden rounded-2xl border-2 border-ink bg-white shadow-[0_4px_0_0_rgba(26,26,26,1)] ${
        faded ? "opacity-70" : "transition-transform hover:-translate-y-1"
      }`}
    >
      {canDismiss && !faded && !myStatus && (
        <button
          type="button"
          onClick={markNotForMe}
          disabled={busy}
          aria-label={t("card.notForMe")}
          className="absolute right-1.5 top-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink bg-white text-lg font-black leading-none text-ink shadow-[0_2px_0_0_rgba(26,26,26,1)] hover:bg-cream disabled:opacity-50"
        >
          ×
        </button>
      )}
      <Link href={`/vibes/${vibe.id}`} className="flex h-full flex-col">
        {/* Artwork — square so the whole cover shows, never cropped */}
        <div className="relative aspect-square w-full border-b-2 border-ink bg-cream">
          {cover ? (
            <Image
              src={cover}
              alt=""
              fill
              sizes="(max-width:640px) 33vw, 240px"
              className="object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-3xl">🎟️</div>
          )}
          <span className="absolute left-1.5 top-1.5 rounded-full border-2 border-ink bg-white px-1.5 py-0.5 text-[9px] font-extrabold lowercase leading-none text-ink">
            {catLabel(vibe.category)}
          </span>
          {faded ? (
            typeof rating === "number" && rating > 0 && (
              <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full border-2 border-ink bg-white px-1.5 py-0.5 text-[9px] font-extrabold leading-none text-ink">
                <Star size={9} className="fill-flockie-coral text-flockie-coral" /> {rating.toFixed(1)}
              </span>
            )
          ) : myStatus && STATUS_CHIP.includes(myStatus) ? (
            <span className="absolute right-1.5 top-1.5 rounded-full border-2 border-ink bg-flockie-orange px-1.5 py-0.5 text-[9px] font-extrabold leading-none text-white">
              {t(`status.${myStatus}`)}
            </span>
          ) : null}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-2.5">
          <p className="line-clamp-2 text-[13px] font-extrabold leading-tight text-ink">
            {vibe.title}
          </p>
          <p className="mt-1 text-[11px] font-bold leading-tight text-flockie-orange">
            {formatVibeWhen(vibe.starts_at)}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-muted">
            <MapPin size={11} className="shrink-0" />
            <span className="truncate">{approximateLocation}</span>
          </p>

          {shownCategories.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {shownCategories.map((c) => (
                <span
                  key={c}
                  className="rounded-full border-2 border-ink bg-cream px-1.5 py-0.5 text-[9px] font-extrabold lowercase leading-none text-ink"
                >
                  {catLabel(c)}
                </span>
              ))}
              {extraCategories > 0 && (
                <span className="text-[9px] font-extrabold leading-none text-muted">
                  +{extraCategories}
                </span>
              )}
            </div>
          )}

          <div className="mt-auto pt-2">
            <div className="flex items-center justify-between gap-1 pt-0.5">
              <span className="flex min-w-0 items-center gap-1 text-[11px] font-medium text-ink">
                {hostAvatar ? (
                  <Image
                    src={hostAvatar}
                    alt=""
                    width={18}
                    height={18}
                    className="h-[18px] w-[18px] shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-flockie-blue text-[9px] font-bold text-white">
                    {hostName[0]}
                  </span>
                )}
                <span className="truncate">{hostName}</span>
              </span>
              <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-muted">
                <Users size={11} /> {faded ? t("card.went", { count: confirmedCount }) : `${confirmedCount}/${vibe.capacity}`}
              </span>
            </div>
            {!faded && typeof matchPct === "number" && (
              <span className="mt-2 block w-fit rounded-full border-2 border-ink bg-flockie-coral px-2 py-0.5 text-[10px] font-extrabold leading-none text-white">
                {t("card.match", { pct: matchPct })}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
