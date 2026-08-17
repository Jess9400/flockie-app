"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { formatVibeWhen } from "@/lib/vibes";

type Attendee = { id: string; name: string; photo: string | null };

// Always-visible strip in the club chat: the NEXT gathering with the
// confirmed attendees (faces + names) so the whole group sees who's going,
// plus the same unified going-tick as the calendar and the gathering page.
export default function ClubNextGatheringStrip({ clubId, meId }: { clubId: string; meId: string }) {
  const supabase = createClient();
  const t = useTranslations("clubs.calendar");
  const locale = useLocale();
  const [gathering, setGathering] = useState<{
    id: string;
    title: string | null;
    starts_at: string;
    timezone: string | null;
  } | null>(null);
  const [going, setGoing] = useState<Attendee[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: gRows } = await supabase.rpc("club_gatherings", { p_club: clubId });
      const next = ((gRows ?? []) as { id: string; title: string | null; starts_at: string; timezone: string | null; status: string }[])
        .filter((g) => g.status !== "cancelled" && new Date(g.starts_at) > new Date())
        .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))[0];
      if (!alive || !next) return;
      setGathering(next);
      const { data: att } = await supabase.rpc("vibe_attendees", { p_vibe: next.id });
      if (!alive) return;
      setGoing(
        ((att ?? []) as { id: string; display_name: string | null; photos: string[] | null }[]).map((a) => ({
          id: a.id,
          name: a.display_name ?? "Flockie",
          photo: a.photos?.[0] ?? null,
        }))
      );
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  if (!gathering) return null;

  const iAmIn = going.some((a) => a.id === meId);
  const firstNames = going.slice(0, 3).map((a) => a.name.split(" ")[0]);
  const extra = going.length - firstNames.length;

  async function tick() {
    if (!gathering || iAmIn) return;
    setBusy(true);
    const { error } = await supabase.rpc("express_interest", { p_vibe: gathering.id });
    setBusy(false);
    if (!error) setGoing((cur) => [...cur, { id: meId, name: "You", photo: null }]);
  }

  return (
    <div className="mb-2 flex items-center gap-2 rounded-2xl border border-flockie-blue/30 bg-flockie-blue/5 px-3 py-2">
      <CalendarDays size={16} className="shrink-0 text-flockie-blue" />
      <Link href={`/vibes/${gathering.id}`} className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-ink">
          {gathering.title ?? t("gatheringFallback")}
          <span className="font-semibold text-muted"> · {formatVibeWhen(gathering.starts_at, locale, gathering.timezone)}</span>
        </span>
        {going.length > 0 && (
          <span className="mt-0.5 flex items-center gap-1.5">
            <span className="flex -space-x-1.5">
              {going.slice(0, 5).map((a) =>
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
            <span className="truncate text-[11px] font-bold text-muted">
              {t("namesGoing", {
                names: firstNames.join(", "),
                extra,
              })}
            </span>
          </span>
        )}
      </Link>
      {!iAmIn && (
        <button
          type="button"
          onClick={tick}
          disabled={busy}
          className="flex shrink-0 items-center gap-1 rounded-full border-2 border-ink/20 bg-white px-2.5 py-1 text-xs font-extrabold text-ink/70 hover:text-ink disabled:opacity-50"
        >
          <Check size={12} strokeWidth={3} /> {t("goingCta")}
        </button>
      )}
    </div>
  );
}
