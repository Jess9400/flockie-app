import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import SwipeDeck from "@/components/SwipeDeck";
import TripPicker from "@/components/TripPicker";
import InviteFriendsButton from "@/components/InviteFriendsButton";
import { loadUserRatings } from "@/lib/vibe-stats";

const MIN_PROFILES = 10;

export default async function MatchPage({
  searchParams,
}: {
  searchParams: { mode?: string; trip?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const mode = searchParams.mode === "activity" ? "activity" : "trip";
  const isActivity = mode === "activity";

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete, activities")
    .eq("id", user!.id)
    .maybeSingle();
  const complete = !!profile?.onboarding_complete && (profile?.activities ?? []).length > 0;

  const subToggle = (
    <div className="mt-3 inline-flex gap-1 rounded-full border-2 border-ink bg-cream p-1 text-xs font-bold">
      <Link href="/match?mode=trip" className={`rounded-full px-4 py-1 ${!isActivity ? "bg-ink text-white" : "text-ink"}`}>
        Trip
      </Link>
      <Link href="/match?mode=activity" className={`rounded-full px-4 py-1 ${isActivity ? "bg-ink text-white" : "text-ink"}`}>
        Activity
      </Link>
    </div>
  );

  const header = (
    <>
      <h1 className="text-2xl font-black">Find a Buddy</h1>
      <p className="mt-1 text-sm font-medium text-muted">
        {isActivity ? (
          <>
            1:1 matching — you both swipe, mutual likes connect to do an activity in your
            city. Want a group event?{" "}
            <Link href="/vibes/new" className="font-bold text-flockie-orange underline">
              Create a Vibe
            </Link>
            .
          </>
        ) : (
          <>
            1:1 matching buddy travel — you both swipe, mutual likes connect. Want a travel
            group?{" "}
            <Link href="/match/trip?kind=flock" className="font-bold text-flockie-orange underline">
              Create a Flock
            </Link>
            .
          </>
        )}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-full border-2 border-ink bg-white p-1 text-sm font-bold">
        <span className="rounded-full bg-flockie-orange py-2 text-center text-white">Find a Buddy</span>
        <Link href="/flocks" className="rounded-full py-2 text-center text-ink">Find a Flock</Link>
      </div>
      {subToggle}
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

  const { data: postRows } = await supabase
    .from("trips")
    .select("id, title, destination, destinations, start_date, end_date, group_size")
    .eq("user_id", user!.id)
    .eq("status", "active")
    .eq("kind", mode)
    .neq("visibility", "public") // public group trips are Flocks, not 1:1 buddy posts
    .order("created_at", { ascending: false })
    .limit(20);
  const posts = postRows ?? [];

  // Which post are we matching on? The one from ?trip=, else the most recent.
  const selectedId =
    searchParams.trip && posts.some((p) => p.id === searchParams.trip)
      ? searchParams.trip
      : posts[0]?.id ?? null;
  const post = posts.find((p) => p.id === selectedId) ?? null;

  const pickerOptions = posts.map((p) => ({
    id: p.id,
    label:
      (isActivity && p.title ? p.title : null) ||
      (p.destinations ?? [p.destination]).filter(Boolean).join(" · ") ||
      "Untitled",
  }));

  if (!post) {
    return (
      <main className="px-5 pb-10 pt-6">
        {header}
        <Gate
          text={isActivity
            ? "Post an activity to find people to do it with in your city."
            : "Post a trip to find buddies heading to the same place."}
          cta={isActivity ? "Post an activity" : "Post a trip"}
          href={`/match/trip?kind=${mode}`}
        />
      </main>
    );
  }

  const label = isActivity
    ? (post.destinations ?? [post.destination]).filter(Boolean).join(" · ")
    : (post.destinations ?? [post.destination]).filter(Boolean).join(" · ");

  async function enrich<T extends { id: string }>(list: T[]) {
    const ratings = await loadUserRatings(supabase, list.map((c) => c.id));
    return list.map((c) => ({
      ...c,
      rating: ratings[c.id]?.avg ?? null,
      review_count: ratings[c.id]?.count ?? 0,
    }));
  }

  let body: React.ReactNode;

  if (isActivity) {
    // Discovery pool: anyone in the activity's city who is open to discovery —
    // no posted activity or city-count gate required.
    const { data: cands } = await supabase.rpc("activity_candidates", { p_trip: selectedId, p_limit: 30 });
    body = <SwipeDeck candidates={await enrich(cands ?? [])} activityTitle={post.title || label} />;
  } else {
    // Trips still use the destination/date-overlap pool + the city gate.
    let { data: count, error: countErr } = await supabase.rpc("buddy_dest_count", { p_kind: mode, p_trip: selectedId });
    if (countErr) ({ data: count } = await supabase.rpc("buddy_dest_count", { p_kind: mode }));
    const enough = (count ?? 0) >= MIN_PROFILES;

    if (!enough) {
      body = (
        <div className="mt-6 rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-[0_5px_0_0_rgba(26,26,26,1)]">
          <p className="text-3xl">🚀</p>
          <p className="mt-3 text-lg font-extrabold">You&rsquo;re on the list for {label}</p>
          <p className="mt-1 text-sm font-medium text-ink/70">
            Buddy matching unlocks as more travelers join {label} — invite friends to make it
            happen faster.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <InviteFriendsButton city={label} />
            <Link href="/vibes" className="rounded-full border-2 border-ink bg-white px-5 py-2.5 font-bold text-ink">
              Meanwhile, explore Vibes
            </Link>
          </div>
        </div>
      );
    } else {
      let { data: candidates, error: candErr } = await supabase.rpc("buddy_candidates_trip", { p_limit: 30, p_kind: mode, p_trip: selectedId });
      if (candErr) ({ data: candidates } = await supabase.rpc("buddy_candidates_trip", { p_limit: 30, p_kind: mode }));
      body = <SwipeDeck candidates={await enrich(candidates ?? [])} />;
    }
  }

  return (
    <main className="px-5 pb-10 pt-6">
      {header}

      <div className="mt-4 flex items-end gap-2">
        {selectedId && (
          <div className="flex-1">
            <TripPicker options={pickerOptions} value={selectedId} mode={mode} />
          </div>
        )}
        <Link
          href={`/match/trip?kind=${mode}`}
          className="flex shrink-0 items-center gap-1 rounded-2xl border-2 border-ink bg-flockie-orange px-4 py-2.5 text-sm font-bold text-white shadow-[0_3px_0_0_#E0512C]"
        >
          <Plus size={16} /> New {isActivity ? "activity" : "trip"}
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
