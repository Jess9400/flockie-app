import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Star, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import TripForm from "@/components/TripForm";

type Pending = { buddy_id: string; display_name: string | null; photo: string | null; destination: string | null };

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

  const reqKind: "trip" | "activity" | "flock" =
    searchParams.kind === "activity" ? "activity" : searchParams.kind === "flock" ? "flock" : "trip";

  // Only load a trip when explicitly editing (?id=). Otherwise it's a NEW post,
  // so a blank form is shown and a new trip is inserted (existing trips stay).
  const { data: trip } = searchParams.id
    ? await supabase
        .from("trips")
        .select("id, destination, destinations, title, kind, start_date, end_date, group_size, trip_type, budget, pace, visibility")
        .eq("user_id", user!.id)
        .eq("id", searchParams.id)
        .maybeSingle()
    : { data: null };

  const kind: "trip" | "activity" | "flock" = trip
    ? trip.kind === "activity"
      ? "activity"
      : trip.visibility === "public"
        ? "flock"
        : "trip"
    : reqKind;
  const isActivity = kind === "activity";
  const isFlock = kind === "flock";

  const initial = trip ?? {
    destinations: !isActivity && profile?.home_city ? [profile.home_city] : [],
    trip_type: profile?.trip_vibe ?? [],
    budget: profile?.budget ?? 3,
    pace: profile?.pace ?? 3,
    group_size: isFlock ? 4 : 2,
  };

  // Creation gates only apply to brand-new posts (editing is always allowed).
  const isNew = !trip;
  const { data: pending } = await supabase.rpc("pending_reviews");
  const pendingList = (pending ?? []) as Pending[];

  let atCap = false;
  if (isNew && kind !== "activity") {
    const { count } = await supabase
      .from("trips")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .eq("kind", "trip")
      .eq("status", "active");
    atCap = (count ?? 0) >= 10;
  }

  const showReviewGate = isNew && pendingList.length > 0;
  const showCapGate = isNew && !showReviewGate && atCap;

  return (
    <main className="px-5 pb-10 pt-6">
      <Link href={isFlock ? "/flocks" : `/match?mode=${kind}`} className="mb-3 flex w-fit items-center gap-1 text-sm font-bold text-muted">
        <ChevronLeft size={16} /> Back
      </Link>
      <h1 className="text-2xl font-black">
        {trip
          ? isActivity ? "Edit your activity" : isFlock ? "Edit your Flock" : "Edit your trip"
          : isActivity ? "Post an activity" : isFlock ? "Create a Flock" : "Post a trip"}
      </h1>
      <p className="mt-1 text-sm font-medium text-muted">
        {isActivity
          ? "Find people to do something with in your city."
          : isFlock
            ? "A group trip others can request to join."
            : "Find one travel buddy heading the same way."}
      </p>
      {showReviewGate ? (
        <div className="mt-6 rounded-3xl border-2 border-ink bg-white p-5 shadow-[0_5px_0_0_rgba(26,26,26,1)]">
          <p className="flex items-center gap-2 text-lg font-extrabold">
            <Star size={18} className="text-flockie-orange" /> Review first
          </p>
          <p className="mt-1 text-sm font-medium text-muted">
            You travelled with these buddies — leave a quick review before posting your
            next {isActivity ? "activity" : "trip"}. It keeps Flockie honest.
          </p>
          <ul className="mt-4 space-y-2">
            {pendingList.map((b) => (
              <li key={b.buddy_id}>
                <Link
                  href={`/review/${b.buddy_id}`}
                  className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-cream p-3 transition-transform hover:-translate-y-0.5"
                >
                  {b.photo ? (
                    <Image src={b.photo} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-flockie-blue font-bold text-white">
                      {(b.display_name || "F")[0]}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{b.display_name || "Your buddy"}</span>
                    {b.destination && (
                      <span className="block truncate text-xs font-medium text-muted">{b.destination}</span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-flockie-orange">
                    Review <ArrowRight size={15} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : showCapGate ? (
        <div className="mt-6 rounded-3xl border-2 border-ink bg-white p-8 text-center shadow-[0_5px_0_0_rgba(26,26,26,1)]">
          <p className="text-3xl">🧳</p>
          <p className="mt-3 text-lg font-extrabold">You&rsquo;ve got 10 active trips</p>
          <p className="mt-2 font-medium text-ink/70">
            That&rsquo;s the max. Complete or close one before posting another. (Activities
            have no limit.)
          </p>
          <Link
            href="/my-trips"
            className="mt-5 inline-block rounded-full border-2 border-ink bg-flockie-orange px-5 py-2.5 font-bold text-white shadow-[0_4px_0_0_#E0512C]"
          >
            Manage my trips
          </Link>
        </div>
      ) : (
        <div className="mt-6">
          <TripForm userId={user!.id} initial={initial} kind={kind} />
        </div>
      )}
    </main>
  );
}
