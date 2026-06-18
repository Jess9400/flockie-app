import Link from "next/link";
import { Pencil, MapPin, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import SwipeDeck from "@/components/SwipeDeck";

const MIN_PROFILES = 20; // need at least this many travelers per destination

export default async function MatchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete, activities")
    .eq("id", user!.id)
    .maybeSingle();
  const complete = !!profile?.onboarding_complete && (profile?.activities ?? []).length > 0;

  const header = (
    <>
      <h1 className="text-2xl font-black">Find a buddy</h1>
      <p className="mt-1 text-sm font-medium text-muted">
        Post a trip, then swipe vibe-matched travelers heading the same way.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-full border-2 border-ink bg-white p-1 text-sm font-bold">
        <span className="rounded-full bg-flockie-orange py-2 text-center text-white">Find a Buddy</span>
        <Link href="/flocks" className="rounded-full py-2 text-center text-ink">Find a Flock</Link>
      </div>
    </>
  );

  if (!complete) {
    return (
      <main className="px-5 pb-10 pt-6">
        {header}
        <Gate text="Complete your vibe check to start matching." cta="Complete my vibe check" href="/profile" />
      </main>
    );
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("id, destination, start_date, end_date, group_size")
    .eq("user_id", user!.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (!trip) {
    return (
      <main className="px-5 pb-10 pt-6">
        {header}
        <Gate
          text="Post a trip to find buddies heading to the same place at the same time."
          cta="Post a trip"
          href="/match/trip"
        />
      </main>
    );
  }

  const { data: count } = await supabase.rpc("buddy_dest_count");
  const enough = (count ?? 0) >= MIN_PROFILES;

  let body: React.ReactNode;
  if (!enough) {
    body = (
      <div className="mt-6 rounded-3xl border-2 border-ink bg-white p-8 text-center shadow-[0_5px_0_0_rgba(26,26,26,1)]">
        <p className="text-3xl">🌍</p>
        <p className="mt-3 text-lg font-extrabold">Buddy matching isn&rsquo;t live for {trip.destination} yet</p>
        <p className="mt-2 font-medium text-ink/70">
          We&rsquo;re still gathering travelers heading to {trip.destination}.
          We&rsquo;ll notify you the moment matching opens there. Meanwhile, create
          or join a Vibe.
        </p>
        <Link href="/vibes" className="mt-5 inline-block rounded-full border-2 border-ink bg-flockie-orange px-5 py-2.5 font-bold text-white shadow-[0_4px_0_0_#E0512C]">
          Explore Vibes
        </Link>
      </div>
    );
  } else {
    const { data: candidates } = await supabase.rpc("buddy_candidates_trip", { p_limit: 30 });
    body = <SwipeDeck candidates={candidates ?? []} />;
  }

  return (
    <main className="px-5 pb-10 pt-6">
      {header}

      {/* trip summary */}
      <div className="mt-5 flex items-center justify-between rounded-2xl border-2 border-ink bg-cream p-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-extrabold">
            <MapPin size={15} className="text-flockie-orange" /> {trip.destination}
          </p>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <CalendarClock size={13} /> {trip.start_date} → {trip.end_date} · {trip.group_size} people
          </p>
        </div>
        <Link href="/match/trip" className="flex shrink-0 items-center gap-1 rounded-full border-2 border-ink bg-white px-3 py-1.5 text-sm font-bold">
          <Pencil size={14} /> Edit
        </Link>
      </div>

      {body}
    </main>
  );
}

function Gate({ text, cta, href }: { text: string; cta: string; href: string }) {
  return (
    <div className="mt-6 rounded-3xl border-2 border-ink bg-white p-8 text-center shadow-[0_5px_0_0_rgba(26,26,26,1)]">
      <p className="font-medium text-ink/70">{text}</p>
      <Link href={href} className="mt-5 inline-block rounded-full border-2 border-ink bg-flockie-orange px-5 py-2.5 font-bold text-white shadow-[0_4px_0_0_#E0512C]">
        {cta}
      </Link>
    </div>
  );
}
