import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, Star, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import TripForm from "@/components/TripForm";
import TripVibeForm from "@/components/TripVibeForm";
import ActivityVibeForm from "@/components/ActivityVibeForm";

type Pending = { buddy_id: string; display_name: string | null; photo: string | null; destination: string | null };

export default async function TripPage({
  searchParams,
}: {
  searchParams: { id?: string; kind?: string };
}) {
  const supabase = await createClient();
  const user = await getSessionUser();
  const t = await getTranslations("match.create");

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
        .select("id, destination, destinations, title, kind, start_date, end_date, group_size, trip_type, budget, pace, visibility, cover_photo")
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

  // Vibe-form gate: a trip/flock needs the Trip vibe; an activity needs the
  // Activity vibe. Migration-safe — if the flag columns don't exist yet, the
  // query errors and we degrade open (no gate), so nothing breaks pre-migration.
  const { data: prefs, error: prefsErr } = await supabase
    .from("profiles")
    .select("trip_prefs_complete, activity_prefs_complete")
    .eq("id", user!.id)
    .maybeSingle();
  // Trips keep a TRIMMED one-page prefs form (5 questions — pace, budget,
  // planning, trip vibe, dealbreakers). It doesn't feed scoring (Vibes-only
  // since #244/#261) but dealbreakers feed buddy_hard_block. Activities gate on
  // the new vibe check only for pre-v3 profiles.
  const tripPrefsDone = prefsErr ? true : !!prefs?.trip_prefs_complete;
  const activityPrefsDone = prefsErr ? true : !!prefs?.activity_prefs_complete;
  const needsTripVibe = isNew && !showReviewGate && !showCapGate && !isActivity && !tripPrefsDone;
  const needsActivityVibe = isNew && !showReviewGate && !showCapGate && isActivity && !activityPrefsDone;
  if (needsTripVibe)
    return <TripVibeForm userId={user!.id} redirectAfter={isFlock ? "/match/trip?kind=flock" : "/match/trip?kind=trip"} />;
  if (needsActivityVibe)
    redirect("/onboarding/vibe-check?returnTo=%2Fmatch%2Ftrip%3Fkind%3Dactivity");

  return (
    <main className="px-5 pb-10 pt-6">
      <Link href={isFlock ? "/flocks" : `/match?mode=${kind}`} className="mb-3 flex w-fit items-center gap-1 text-sm font-bold text-muted">
        <ChevronLeft size={16} /> {t("back")}
      </Link>
      <h1 className="text-2xl font-black">
        {trip
          ? isActivity ? t("editHeadingActivity") : isFlock ? t("editHeadingFlock") : t("editHeadingTrip")
          : isActivity ? t("newHeadingActivity") : isFlock ? t("newHeadingFlock") : t("newHeadingTrip")}
      </h1>
      <p className="mt-1 text-sm font-medium text-muted">
        {isActivity
          ? t("subActivity")
          : isFlock
            ? t("subFlock")
            : t("subTrip")}
      </p>
      {showReviewGate ? (
        <div className="mt-6 rounded-3xl border border-ink/15 bg-white p-5 shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
          <p className="flex items-center gap-2 text-lg font-extrabold">
            <Star size={18} className="text-flockie-orange" /> {t("reviewFirstTitle")}
          </p>
          <p className="mt-1 text-sm font-medium text-muted">
            {isActivity ? t("reviewBodyActivity") : t("reviewBodyTrip")}
          </p>
          <ul className="mt-4 space-y-2">
            {pendingList.map((b) => (
              <li key={b.buddy_id}>
                <Link
                  href={`/review/${b.buddy_id}`}
                  className="flex items-center gap-3 rounded-2xl border border-ink/15 bg-cream p-3 transition-transform hover:-translate-y-0.5"
                >
                  {b.photo ? (
                    <Image src={b.photo} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-flockie-blue font-bold text-white">
                      {(b.display_name || "F")[0]}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{b.display_name || t("buddyFallback")}</span>
                    {b.destination && (
                      <span className="block truncate text-xs font-medium text-muted">{b.destination}</span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-flockie-orange">
                    {t("review")} <ArrowRight size={15} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : showCapGate ? (
        <div className="mt-6 rounded-3xl border border-ink/15 bg-white p-8 text-center shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
          <p className="text-3xl">🧳</p>
          <p className="mt-3 text-lg font-extrabold">{t("capTitle")}</p>
          <p className="mt-2 font-medium text-ink/70">
            {t("capBody")}
          </p>
          <Link
            href="/my-trips"
            className="mt-5 inline-block rounded-full border border-ink/15 bg-flockie-orange px-5 py-2.5 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
          >
            {t("manageTrips")}
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
