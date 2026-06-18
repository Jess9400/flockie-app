import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import TripForm from "@/components/TripForm";

export default async function TripPage({
  searchParams,
}: {
  searchParams: { id?: string };
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

  let tripQuery = supabase
    .from("trips")
    .select("id, destination, start_date, end_date, group_size, trip_type, budget, pace")
    .eq("user_id", user!.id);
  tripQuery = searchParams.id
    ? tripQuery.eq("id", searchParams.id)
    : tripQuery.eq("status", "active").order("created_at", { ascending: false });
  const { data: trip } = await tripQuery.maybeSingle();

  // Pre-fill from the existing trip, else from profile defaults
  const initial = trip ?? {
    destination: profile?.home_city ?? "",
    trip_type: profile?.trip_vibe ?? [],
    budget: profile?.budget ?? 3,
    pace: profile?.pace ?? 3,
    group_size: 2,
  };

  return (
    <main className="px-5 pb-10 pt-6">
      <Link href="/match" className="mb-3 flex w-fit items-center gap-1 text-sm font-bold text-muted">
        <ChevronLeft size={16} /> Back
      </Link>
      <h1 className="text-2xl font-black">{trip ? "Edit your trip" : "Post a trip"}</h1>
      <p className="mt-1 text-sm font-medium text-muted">
        Tell us where and when — we&rsquo;ll find vibe-matched buddies heading the
        same way.
      </p>
      <div className="mt-6">
        <TripForm userId={user!.id} initial={initial} />
      </div>
    </main>
  );
}
