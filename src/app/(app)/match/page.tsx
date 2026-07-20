import Link from "next/link";
import { Plus, ArrowRight, ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import SwipeDeck from "@/components/SwipeDeck";
import TripPicker from "@/components/TripPicker";
import ActivityBoardList, { type ActivityFeedRow } from "@/components/ActivityBoardList";
import InviteFriendsButton from "@/components/InviteFriendsButton";
import { loadUserRatings } from "@/lib/vibe-stats";

const MIN_PROFILES = 10;

export default async function MatchPage({
  searchParams,
}: {
  searchParams: { mode?: string; trip?: string; view?: string };
}) {
  const supabase = await createClient();
  const user = await getSessionUser();
  const t = await getTranslations("match.find");

  // Trip buddy matching is parked "Soon" — default to Activity.
  const mode = searchParams.mode === "trip" ? "trip" : "activity";
  const isActivity = mode === "activity";
  // Activity mode has two paths: BROWSE what others posted (default — no setup
  // needed) or CREATE your own and swipe people to invite.
  const view = isActivity && searchParams.view === "create" ? "create" : "browse";

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

  // Two clear paths, big and tappable: browse what's posted (default) or
  // create yours + swipe people to invite. Trips live on their own tab now,
  // so trip mode (reached from the Trips hub) renders no toggle at all.
  const header = (
    <>
      {!isActivity && (
        <Link
          href="/trips"
          className="mb-2 inline-flex items-center gap-1 text-sm font-bold text-ink/55 hover:text-ink"
        >
          <ArrowLeft size={15} /> {t("backToTrips")}
        </Link>
      )}
      <h1 className="text-2xl font-black">
        {isActivity ? t("heading") : t("tripHeading")}
      </h1>
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
      {isActivity && (
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          href="/match"
          className={`rounded-2xl border-2 px-4 py-3 text-center transition-transform hover:-translate-y-0.5 ${
            view === "browse"
              ? "border-flockie-orange bg-flockie-orange/5"
              : "border-ink/10 bg-white"
          }`}
        >
          <span className="block text-lg">🔎</span>
          <span className="block text-sm font-extrabold text-ink">{t("viewBrowse")}</span>
          <span className="block text-[11px] font-medium text-muted">{t("viewBrowseSub")}</span>
        </Link>
        <Link
          href="/match?view=create"
          className={`rounded-2xl border-2 px-4 py-3 text-center transition-transform hover:-translate-y-0.5 ${
            view === "create"
              ? "border-flockie-orange bg-flockie-orange/5"
              : "border-ink/10 bg-white"
          }`}
        >
          <span className="block text-lg">➕</span>
          <span className="block text-sm font-extrabold text-ink">{t("viewCreate")}</span>
          <span className="block text-[11px] font-medium text-muted">{t("viewCreateSub")}</span>
        </Link>
      </div>
      )}
    </>
  );

  // Quick link to manage what you've posted — rendered BELOW the main content
  // (board / deck / gate), mirroring the Trips hub's "your trips" row.
  const yourActivitiesLink = isActivity ? (
    <Link
      href="/my-activities"
      className="mt-4 flex items-center justify-between rounded-2xl border border-ink/15 bg-white px-4 py-3 text-sm font-bold text-ink shadow-[0_2px_10px_rgba(10,37,69,0.08)] transition-transform hover:-translate-y-0.5"
    >
      <span>🗂️ {t("yourActivities")}</span>
      <ArrowRight size={16} className="text-ink/50" />
    </Link>
  ) : null;

  if (!complete) {
    return (
      <main className="px-5 pb-10 pt-6">
        {header}
        <Gate
          text={isActivity ? t("gateVibeCheckText") : t("gateTravelPrefsText")}
          cta={isActivity ? t("gateVibeCheckCta") : t("gateTravelPrefsCta")}
          href={`/match/trip?kind=${mode}`}
        />
        {yourActivitiesLink}
      </main>
    );
  }

  // ── Browse view: activities other people posted in your city. No posting
  // required — this is the default way in. Creating + the invite deck live
  // under the "Create an activity" path.
  if (isActivity && view === "browse") {
    const [{ data: cityProf }, { data: feed, error: feedErr }] = await Promise.all([
      supabase.from("profiles").select("home_city").eq("id", user!.id).maybeSingle(),
      supabase.rpc("activity_feed", { p_limit: 30 }),
    ]);
    // Migration-safe: RPC missing on prod → empty state instead of a crash.
    const rows: ActivityFeedRow[] = feedErr ? [] : ((feed ?? []) as ActivityFeedRow[]);
    return (
      <main className="px-5 pb-10 pt-6">
        {header}
        <ActivityBoardList rows={rows} city={cityProf?.home_city ?? ""} />
        {yourActivitiesLink}
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
        {yourActivitiesLink}
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
        <DeckFrame>
          <SwipeDeck
            candidates={await enrich(cands ?? [])}
            activityId={selectedId}
            activityTitle={post.title || label}
          />
        </DeckFrame>
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
        <div className="mt-6 rounded-3xl border border-ink/15 bg-white p-6 text-center shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
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
            <Link href="/vibes" className="rounded-full border border-ink/15 bg-white px-5 py-2.5 font-bold text-ink">
              {t("exploreVibesMeanwhile")}
            </Link>
          </div>
        </div>
      );
    } else {
      let { data: candidates, error: candErr } = await supabase.rpc("buddy_candidates_trip", { p_limit: 30, p_kind: mode, p_trip: selectedId });
      if (candErr) ({ data: candidates } = await supabase.rpc("buddy_candidates_trip", { p_limit: 30, p_kind: mode }));
      body = (
        <DeckFrame>
          <SwipeDeck candidates={await enrich(candidates ?? [])} />
        </DeckFrame>
      );
    }
  }

  return (
    <main className="px-5 pb-10 pt-6">
      {header}

      <div className="mt-4 flex items-end gap-2">
        {selectedId && (
          <div className="flex-1">
            <TripPicker
              options={pickerOptions}
              value={selectedId}
              mode={mode}
              view={isActivity ? "create" : undefined}
            />
          </div>
        )}
        <Link
          href={`/match/trip?kind=${mode}`}
          className="flex shrink-0 items-center gap-1 rounded-2xl border border-ink/15 bg-flockie-orange px-4 py-2.5 text-sm font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
        >
          <Plus size={16} /> {isActivity ? t("newActivity") : t("newTrip")}
        </Link>
      </div>

      {body}
      {yourActivitiesLink}
    </main>
  );
}

// Crisp confetti accents around the swipe deck — same language as the home
// page's blue panel: small sharp shapes, no blur, clear of the cards.
function DeckFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-x-1 -inset-y-3 z-0" aria-hidden="true">
        <span className="absolute left-1 top-0 text-sm text-flockie-coral/50">✦</span>
        <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-flockie-blue/40" />
        <span className="absolute bottom-6 left-2 h-1.5 w-1.5 rounded-full bg-flockie-coral/50" />
        <span className="absolute bottom-1 right-6 text-xs text-flockie-blue/50">✦</span>
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function Gate({ text, cta, href }: { text: string; cta: string; href: string }) {
  return (
    <div className="mt-6 rounded-3xl border border-ink/15 bg-white p-8 text-center shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
      <p className="font-medium text-ink/70">{text}</p>
      <Link href={href} className="mt-5 inline-block rounded-full border border-ink/15 bg-flockie-orange px-5 py-2.5 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
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
          className="inline-flex items-center justify-center rounded-full border border-ink/15 bg-white px-5 py-2.5 font-bold text-ink"
        >
          {t("exploreVibes")}
        </Link>
      </div>
    </div>
  );
}
