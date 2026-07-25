"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
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

// The club Calendar: the club's scheduled meetings (its gatherings are vibes
// with club_id set — the heartbeat/prepare-gathering flow creates them). This
// reads them, it doesn't create — scheduling stays on the club page.
export default function ClubGatherings({ clubId }: { clubId: string }) {
  const supabase = createClient();
  const t = useTranslations("clubs.calendar");
  const locale = useLocale();
  const [items, setItems] = useState<Gathering[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.rpc("club_gatherings", { p_club: clubId }).then(({ data }) => {
      setItems((data ?? []) as Gathering[]);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  if (loading) return null;

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-ink/15 bg-white px-4 py-6 text-center">
        <p className="text-sm font-extrabold text-ink">{t("emptyTitle")}</p>
        <p className="mt-1 text-xs font-medium text-muted">{t("emptyBody")}</p>
        <Link href={`/clubs/${clubId}`} className="mt-2 inline-block text-xs font-bold text-flockie-blue">
          {t("scheduleLink")} →
        </Link>
      </div>
    );
  }

  const now = Date.now();
  return (
    <ul className="space-y-1.5">
      {items.map((g) => {
        const upcoming = new Date(g.starts_at).getTime() >= now;
        return (
          <li key={g.id}>
            <Link
              href={`/vibes/${g.id}`}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                upcoming ? "border-flockie-blue/30 bg-flockie-blue/5" : "border-ink/10 bg-white opacity-70"
              }`}
            >
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
          </li>
        );
      })}
    </ul>
  );
}
