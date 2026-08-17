"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, Check } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { formatVibeWhen } from "@/lib/vibes";

type Gathering = {
  id: string;
  title: string | null;
  starts_at: string;
  timezone: string | null;
  status: string;
  city: string | null;
};
type Attendee = { id: string; name: string; photo: string | null };

// The club Calendar: the club's scheduled meetings (its gatherings are vibes
// with club_id set). Each member checks whether they'll attend - a personal
// RSVP everyone can see, like ticking the checklist.
export default function ClubGatherings({
  clubId,
  meId,
  meName,
  announce,
}: {
  clubId: string;
  meId: string;
  meName?: string;
  announce?: (text: string) => void;
}) {
  const supabase = createClient();
  const t = useTranslations("clubs.calendar");
  const locale = useLocale();
  const [items, setItems] = useState<Gathering[]>([]);
  const [going, setGoing] = useState<Record<string, Attendee[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: gRows } = await supabase.rpc("club_gatherings", { p_club: clubId });
      const gatherings = (gRows ?? []) as Gathering[];
      const ids = gatherings.map((g) => g.id);
      // Unified with the gathering page: "going" = CONFIRMED attendees (the
      // same list that holds seats, unlocks the address, and feeds the host
      // tally) - not a separate RSVP table.
      const map: Record<string, Attendee[]> = {};
      if (ids.length) {
        const lists = await Promise.all(
          ids.map((id) => supabase.rpc("vibe_attendees", { p_vibe: id }))
        );
        ids.forEach((id, i) => {
          map[id] = (
            (lists[i].data ?? []) as { id: string; display_name: string | null; photos: string[] | null }[]
          ).map((a) => ({ id: a.id, name: a.display_name ?? "Flockie", photo: a.photos?.[0] ?? null }));
        });
      }
      if (!alive) return;
      setItems(gatherings);
      setGoing(map);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  async function toggle(vibeId: string) {
    const list = going[vibeId] ?? [];
    const iAmIn = list.some((a) => a.id === meId);
    if (iAmIn && !confirm(t("leaveConfirm"))) return;
    // Optimistic
    setGoing((cur) => ({
      ...cur,
      [vibeId]: iAmIn ? (cur[vibeId] ?? []).filter((a) => a.id !== meId) : [...(cur[vibeId] ?? []), { id: meId, name: "You", photo: null }],
    }));
    // Same rails as the gathering page: confirm-attendance in, leave to free
    // the seat - so this tick IS the head count everywhere.
    const { error } = iAmIn
      ? await supabase.rpc("leave_vibe", { p_vibe: vibeId })
      : await supabase.rpc("express_interest", { p_vibe: vibeId });
    if (error) {
      // Roll back the optimistic flip.
      setGoing((cur) => ({
        ...cur,
        [vibeId]: iAmIn
          ? [...(cur[vibeId] ?? []), { id: meId, name: "You", photo: null }]
          : (cur[vibeId] ?? []).filter((a) => a.id !== meId),
      }));
      return;
    }
    if (!iAmIn) {
      const g = items.find((x) => x.id === vibeId);
      announce?.(t("eventGoing", { name: (meName ?? "").split(" ")[0] || "Someone", title: g?.title ?? t("gatheringFallback") }));
    }
  }

  if (loading) return null;

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-ink/15 bg-white px-4 py-6 text-center">
        <p className="text-sm font-extrabold text-ink">{t("emptyTitle")}</p>
        <p className="mt-1 text-xs font-medium text-muted">{t("emptyBody")}</p>
      </div>
    );
  }

  const now = Date.now();
  return (
    <ul className="space-y-2">
      {items.map((g) => {
        const upcoming = new Date(g.starts_at).getTime() >= now;
        const list = going[g.id] ?? [];
        const iAmIn = list.some((a) => a.id === meId);
        return (
          <li key={g.id} className={`rounded-xl border ${upcoming ? "border-flockie-blue/30 bg-flockie-blue/5" : "border-ink/10 bg-white opacity-80"}`}>
            <Link href={`/vibes/${g.id}`} className="flex items-center gap-3 px-3 pt-2.5">
              <CalendarDays size={16} className={`shrink-0 ${upcoming ? "text-flockie-blue" : "text-ink/40"}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-ink">{g.title ?? t("gatheringFallback")}</span>
                <span className="block truncate text-[11px] font-semibold text-muted">
                  {formatVibeWhen(g.starts_at, locale, g.timezone)}
                  {g.city ? ` · ${g.city}` : ""}
                  {!upcoming ? ` · ${t("past")}` : ""}
                </span>
              </span>
              <ChevronRight size={15} className="shrink-0 text-ink/30" />
            </Link>

            {/* RSVP - each member checks if they'll attend */}
            <div className="flex items-center gap-2 px-3 pb-2.5 pt-2">
              {upcoming ? (
                <button
                  type="button"
                  onClick={() => toggle(g.id)}
                  className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-extrabold transition-colors ${
                    iAmIn
                      ? "border-onboarding-green bg-onboarding-green text-white"
                      : "border-ink/20 bg-white text-ink/60 hover:text-ink"
                  }`}
                >
                  <Check size={13} strokeWidth={3} /> {iAmIn ? t("goingYes") : t("goingCta")}
                </button>
              ) : (
                <span className="text-[11px] font-bold text-muted">{t("attendedLabel")}</span>
              )}

              {list.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="flex -space-x-1.5">
                    {list.slice(0, 4).map((a) =>
                      a.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={a.id} src={a.photo} alt="" className="h-5 w-5 rounded-full border border-white object-cover" />
                      ) : (
                        <span key={a.id} className="flex h-5 w-5 items-center justify-center rounded-full border border-white bg-flockie-blue text-[9px] font-bold text-white">
                          {a.name[0]?.toUpperCase()}
                        </span>
                      )
                    )}
                  </span>
                  <span className="text-[11px] font-bold text-muted">{t("goingCount", { count: list.length })}</span>
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
