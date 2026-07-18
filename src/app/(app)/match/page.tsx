import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
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
  const user = await getSessionUser();
  const t = await getTranslations("match.find");
  const tc = await getTranslations("common");

  // Trip buddy matching is parked "Soon" — default to Activity.
  const mode = searchParams.mode === "trip" ? "trip" : "activity";
  const isActivity = mode === "activity";

  // Trip matching only needs the Trip vibe (trip_prefs); activity matching
  // needs the activity vibe check. Migration-safe: if the trip_prefs column
  // doesn't exist yet, the query errors and we degrade open (no gate).
  const [{ data: profile }, { data: prefs, error: prefsErr }] = await Promise.all([
    supabase
      .from("profiles")
      .select("onboarding_complete, activities, display_name")
      .eq("id", user!.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("trip_prefs_complete")
      .eq("id", user!.id)
      .maybeSingle(),
  ]);
  const tripPrefsDone = prefsErr ? true : !!prefs?.trip_prefs_complete;
  const complete = isActivity
    ? !!profile?.onboarding_complete && (profile?.activities ?? []).length > 0
    : tripPrefsDone;

  const subToggle = (
    <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-ink/15 p-1 text-xs font-bold">
      <Link href="/match?mode=activity" className={`rounded-full px-4 py-1 ${isActivity ? "bg-flockie-orange text-white" : "text-ink/55 hover:text-ink"}`}>
        {t("toggleActivity")}
      </Link>
      <span aria-disabled="true" className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full px-4 py-1 text-ink/35">
        {t("toggleTrip")}
        <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-ink/50">
          {tc("soon")}
        </span>
      </span>
    </div>
  );

  const header = (
    <>
      <h1 className="text-2xl font-black">{t("heading")}</h1>
      <p className="mt-1 text-sm font-medium text-muted">
        {isActivity
          ? t.rich("introActivity", {
              link: (chunks) => (
                <Link href="/vibes/new" className="font-bold text-flockie-orange underline">
                  {chunks}
                </Link>
              ),
            })
          : t.rich("introTrip", {
              link: (chunks) => (
                <Link href="/match/trip?kind=flock" className="font-bold text-flockie-orange underline">
                  {chunks}
                </Link>
              ),
            })}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-full border border-ink/15 p-1 text-sm font-bold">
        <span className="rounded-full bg-flockie-orange py-2 text-center text-white">{t("tabBuddy")}</span>
        <span
          aria-disabled="true"
          className="inline-flex cursor-not-allowed items-center justify-center gap-1.5 rounded-full py-2 text-center text-ink/35"
        >
          {t("tabFlock")}
          <span className="rounded-full bg-cream px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-ink/50">
            {tc("soon")}
          </span>
        </span>
      </div>
      {subToggle}
    </>
  );

  if (!complete) {
    return (
      <main className="px-5 pb-10 pt-6">
        {header}
        <Gate
          text={isActivity ? t("gateVibeCheckText") : t("gateTravelPrefsText")}
          cta={isActivity ? t("gateVibeCheckCta") : t("gateTravelPrefsCta")}
          href={`/match/trip?kind=${mode}`}
        />
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
      t("pickerUntitled"),
  }));

  if (!post) {
    return (
      <main className="px-5 pb-10 pt-6">
        {header}
        <Gate
          text={isActivity ? t("gatePostActivityText") : t("gatePostTripText")}
          cta={isActivity ? t("gatePostActivityCta") : t("gatePostTripCta")}
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
    body =
      (cands ?? []).length > 0 ? (
        <SwipeDeck
          candidates={await enrich(cands ?? [])}
          activityId={selectedId}
          activityTitle={post.title || label}
        />
      ) : (
        <ActivityEmptyState
          userId={user!.id}
          userName={profile?.display_name ?? undefined}
          city={label}
        />
      );
  } else {
    // Trips still use the destination/date-overlap pool + the city gate.
    let { data: count, error: countErr } = await supabase.rpc("buddy_dest_count", { p_kind: mode, p_trip: selectedId });
    if (countErr) ({ data: count } = await supabase.rpc("buddy_dest_count", { p_kind: mode }));
    const enough = (count ?? 0) >= MIN_PROFILES;

    if (!enough) {
      body = (
        <div className="mt-6 rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-[0_5px_0_0_rgba(26,26,26,1)]">
          <p className="text-3xl">🚀</p>
          <p className="mt-3 text-lg font-extrabold">{t("onListTitle", { label })}</p>
          <p className="mt-1 text-sm font-medium text-ink/70">
            {t("onListBody", { label })}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <InviteFriendsButton
              inviterId={user!.id}
              inviterName={profile?.display_name ?? undefined}
              city={label}
            />
            <Link href="/vibes" className="rounded-full border-2 border-ink bg-white px-5 py-2.5 font-bold text-ink">
              {t("exploreVibesMeanwhile")}
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
          <Plus size={16} /> {isActivity ? t("newActivity") : t("newTrip")}
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

async function ActivityEmptyState({
  userId,
  userName,
  city,
}: {
  userId: string;
  userName?: string;
  city: string;
}) {
  const t = await getTranslations("match.find");
  return (
    <div className="mt-6 rounded-3xl border-2 border-dashed border-ink/30 bg-white p-7 text-center">
      <p className="text-3xl">👋</p>
      <p className="mt-3 text-lg font-extrabold">{t("emptyActivityTitle")}</p>
      <p className="mt-1 text-sm font-medium leading-relaxed text-muted">
        {t("emptyActivityBody", { city: city || t("cityFallback") })}
      </p>
      <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
        <InviteFriendsButton
          inviterId={userId}
          inviterName={userName}
          city={city || undefined}
          label={t("inviteFriend")}
        />
        <Link
          href="/vibes"
          className="inline-flex items-center justify-center rounded-full border-2 border-ink bg-white px-5 py-2.5 font-bold text-ink"
        >
          {t("exploreVibes")}
        </Link>
      </div>
    </div>
  );
}
