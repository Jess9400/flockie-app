import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import TripVibeForm from "@/components/TripVibeForm";

// The Trips hub (nav tab): everything travel-shaped lives here - find a buddy
// for a trip (parked "Soon"), find a Flock (group trips), and your own trips.
export default async function TripsHubPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  const tr = await getTranslations("trips");

  // One-time travel form at the door (founder call): complete it here, then
  // everything inside - browsing flocks, creating trips, swiping - is free.
  const { data: prefs, error: prefsErr } = await supabase
    .from("profiles")
    .select("trip_prefs_complete")
    .eq("id", user!.id)
    .maybeSingle();
  const tripPrefsDone = prefsErr ? true : !!prefs?.trip_prefs_complete;
  if (!tripPrefsDone) {
    return <TripVibeForm userId={user!.id} redirectAfter="/trips" />;
  }

  return (
    <main className="px-5 pb-10 pt-6">
      <h1 className="text-2xl font-black">{tr("hub.heading")}</h1>
      <p className="mt-1 text-sm font-medium text-muted">{tr("hub.subtitle")}</p>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Link
          href="/flocks"
          className="rounded-2xl border-2 border-ink/10 bg-white px-4 py-5 text-center transition-transform hover:-translate-y-0.5"
        >
          <span className="block text-2xl">🔎</span>
          <span className="mt-1 block text-sm font-extrabold text-ink">{tr("hub.browseBoard")}</span>
          <span className="block text-[11px] font-medium text-muted">{tr("hub.browseBoardSub")}</span>
        </Link>
        <Link
          href="/match/trip?kind=trip"
          className="rounded-2xl border-2 border-ink/10 bg-white px-4 py-5 text-center transition-transform hover:-translate-y-0.5"
        >
          <span className="block text-2xl">➕</span>
          <span className="mt-1 block text-sm font-extrabold text-ink">{tr("hub.postTrip")}</span>
          <span className="block text-[11px] font-medium text-muted">{tr("hub.postTripSub")}</span>
        </Link>
      </div>

      <Link
        href="/my-trips"
        className="mt-3 flex items-center justify-between rounded-2xl border border-ink/15 bg-white px-4 py-3.5 text-sm font-bold text-ink shadow-[0_2px_10px_rgba(10,37,69,0.08)] transition-transform hover:-translate-y-0.5"
      >
        <span>🧳 {tr("hub.yourTrips")}</span>
        <ArrowRight size={16} className="text-ink/50" />
      </Link>
    </main>
  );
}
