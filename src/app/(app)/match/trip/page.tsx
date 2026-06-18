import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import TripForm from "@/components/TripForm";

export default async function TripPage({
  searchParams,
}: {
  searchParams: { id?: string; kind?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("home_city, budget, pace, trip_vibe")
    .eq("id", user!.id)
    .maybeSingle();

  let q = supabase
    .from("trips")
    .select("id, destination, destinations, title, kind, start_date, end_date, group_size, trip_type, budget, pace, visibility")
    .eq("user_id", user!.id);

  const reqKind = searchParams.kind === "activity" ? "activity" : "trip";
  q = searchParams.id
    ? q.eq("id", searchParams.id)
    : q.eq("status", "active").eq("kind", reqKind).order("created_at", { ascending: false });
  const { data: trip } = await q.maybeSingle();

  const kind = (trip?.kind as "trip" | "activity") ?? reqKind;
  const isActivity = kind === "activity";

  const initial = trip ?? {
    destinations: !isActivity && profile?.home_city ? [profile.home_city] : [],
    trip_type: profile?.trip_vibe ?? [],
    budget: profile?.budget ?? 3,
    pace: profile?.pace ?? 3,
    group_size: 2,
  };

  return (
    <main className="px-5 pb-10 pt-6">
      <Link href={`/match?mode=${kind}`} className="mb-3 flex w-fit items-center gap-1 text-sm font-bold text-muted">
        <ChevronLeft size={16} /> Back
      </Link>
      <h1 className="text-2xl font-black">
        {trip ? (isActivity ? "Edit your activity" : "Edit your trip") : isActivity ? "Post an activity" : "Post a trip"}
      </h1>
      <p className="mt-1 text-sm font-medium text-muted">
        {isActivity
          ? "Find people to do something with in your city."
          : "Find vibe-matched buddies heading the same way."}
      </p>
      <div className="mt-6">
        <TripForm userId={user!.id} initial={initial} kind={kind} />
      </div>
    </main>
  );
}
