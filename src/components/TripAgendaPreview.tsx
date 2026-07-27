import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

type AgendaItem = { id: string; day: string | null; title: string; note: string | null };

// Read-only itinerary shown on the trip/flock detail page to EVERYONE (public
// flocks) or members (private trips) - so browsers see what the trip is about.
// Editing happens in the member-only workspace.
export default async function TripAgendaPreview({ tripId, clubId }: { tripId?: string; clubId?: string }) {
  const supabase = await createClient();
  const t = await getTranslations("trips.detail");
  const { data } = clubId
    ? await supabase.rpc("club_agenda_preview", { p_club: clubId })
    : await supabase.rpc("trip_agenda_preview", { p_trip: tripId! });
  const items = (data ?? []) as AgendaItem[];
  if (items.length === 0) return null;

  return (
    <div className="mt-6">
      <p className="text-xs font-extrabold uppercase tracking-wide text-ink/50">{t("itinerary")}</p>
      <ol className="mt-2 space-y-1.5">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2.5 rounded-xl border border-ink/10 bg-white px-3 py-2">
            {it.day && (
              <span className="shrink-0 rounded-lg bg-flockie-blue/10 px-2 py-1 text-[10px] font-extrabold text-flockie-blue">
                {new Date(it.day).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            )}
            <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{it.title}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
