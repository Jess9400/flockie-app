import Link from "next/link";
import Image from "next/image";
import { getTranslations, getLocale } from "next-intl/server";
import { ArrowRight, MapPin, MessageCircle, Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import { format } from "date-fns";
import VibeCard, { type VibeCardData } from "@/components/VibeCard";
import SeeAllNearYou from "@/components/SeeAllNearYou";
import FeedSection, { type FeedPost } from "@/components/FeedSection";
import SayHiButton from "@/components/SayHiButton";
import JoinActivityButton from "@/components/JoinActivityButton";
import { dfLocale } from "@/lib/date-locale";
import HomeHero from "@/components/HomeHero";
import HomePlans from "@/components/HomePlans";
import HomeActions from "@/components/HomeActions";
import Squiggle from "@/components/Squiggle";
import MatchKeyTip from "@/components/MatchKeyTip";
import InviteFriendsButton from "@/components/InviteFriendsButton";
import ReviewsToDoBanner from "@/components/ReviewsToDoBanner";
import EarlyCityState from "@/components/EarlyCityState";
import { loadVibeMatch } from "@/lib/vibe-stats";
import { formatVibeWhen, type InterestStatus } from "@/lib/vibes";
import { VIBE_ONBOARDING_INTERESTS } from "@/lib/onboarding/vibe-onboarding";

type CityPerson = {
  id: string;
  display_name: string | null;
  age: number | null;
  photos: string[] | null;
  one_liner: string | null;
  home_city: string | null;
  score: number | null;
  shared_interests: string[] | null;
  shared_styles: string[] | null;
};

const INTEREST_LABELS = Object.fromEntries(
  VIBE_ONBOARDING_INTERESTS.map((interest) => [interest.id, interest.label])
);
const STYLE_LABELS: Record<string, string> = {
  chill: "Chill",
  quiet: "Low-key",
  social: "Social",
  energetic: "High energy",
  party: "High energy",
  creative: "Creative",
};

type HomeFlock = {
  id: string;
  destination: string | null;
  destinations: string[] | null;
  start_date: string;
  end_date: string;
  group_size: number;
  cover_photo: string | null;
  going: number;
  requested: boolean;
  host_name: string | null;
  host_photo: string | null;
};

type VibeRow = VibeCardData & { host_id: string };

const VIBE_COLS =
  "id, host_id, title, category, categories, photos, city, area, country, starts_at, capacity, event_vibe_tags";

async function loadHostsAndCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  list: { id: string; host_id: string }[]
) {
  const hosts: Record<string, { display_name: string | null; photos: string[] | null }> = {};
  const counts: Record<string, number> = {};
  const hostIds = Array.from(new Set(list.map((v) => v.host_id)));
  const ids = list.map((v) => v.id);

  // "Going" counts via aggregate RPC (vibe_interests is no longer broadly
  // readable; see supabase/vibe-attendees-rls.sql)
  const [hostResult, confirmedResult] = await Promise.all([
    hostIds.length
      ? supabase.from("public_profiles").select("id, display_name, photos").in("id", hostIds)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.rpc("vibe_confirmed_counts", { p_vibes: ids })
      : Promise.resolve({ data: [] }),
  ]);

  hostResult.data?.forEach((h) => (hosts[h.id] = { display_name: h.display_name, photos: h.photos }));
  (confirmedResult.data as { vibe_id: string; going: number }[] | null)?.forEach(
    (r) => (counts[r.vibe_id] = r.going)
  );
  return { hosts, counts };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: { when?: string };
}) {
  const supabase = await createClient();
  const user = await getSessionUser();
  const nowIso = new Date().toISOString();
  // Server-side translations (locale from the NEXT_LOCALE cookie) for the
  // internationalized home header — see messages/*.json `common` namespace.
  const t = await getTranslations("common");
  const th = await getTranslations("home");
  const locale = await getLocale();

  const [
    { data: profile },
    { data: hiddenRows },
    { data: prefRow, error: prefErr },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name, home_city, vibe_completed_at, photos").eq("id", user!.id).maybeSingle(),
    supabase.from("vibe_feedback").select("vibe_id").eq("user_id", user!.id).eq("signal", "not_for_me"),
    supabase
      .from("profiles")
      .select("trip_prefs_complete")
      .eq("id", user!.id)
      .maybeSingle(),
  ]);

  // Joining a Flock needs the Trip form (guarded separately so a missing column
  // can't break the home query).
  const tripPrefsDone = prefErr ? true : !!prefRow?.trip_prefs_complete;

  const firstName = (profile?.display_name?.trim() || "there").split(" ")[0];
  const homeCity = profile?.home_city?.trim() || null;
  const vibeFormDone = !!profile?.vibe_completed_at;
  const timing = searchParams.when === "24" ? "24" : searchParams.when === "48" ? "48" : "all";
  const cutoffHours = timing === "24" ? 24 : timing === "48" ? 48 : null;
  // Which localized `nearYou.*` phrase set to use (see messages/*/home.json).
  const timingKey = timing === "24" ? "24" : timing === "48" ? "48" : "all";
  const cityVariant = homeCity ? "withCity" : "noCity";
  const hiddenVibeIds = Array.from(new Set((hiddenRows ?? []).map((r) => r.vibe_id)));

  // ── Vibes: "near you" (same city + timing filter) and "all cities" ─────
  let nearQuery = supabase
    .from("vibe_directory")
    .select(VIBE_COLS)
    .in("status", ["open", "reviewing", "ranking", "finalized"])
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true })
    .limit(10);
  if (cutoffHours) {
    nearQuery = nearQuery.lte(
      "starts_at",
      new Date(Date.now() + cutoffHours * 3600 * 1000).toISOString()
    );
  }
  if (homeCity) nearQuery = nearQuery.ilike("city", homeCity);
  if (hiddenVibeIds.length) nearQuery = nearQuery.not("id", "in", `(${hiddenVibeIds.join(",")})`);

  let allQuery = supabase
    .from("vibe_directory")
    .select(VIBE_COLS)
    .in("status", ["open", "reviewing", "ranking", "finalized"])
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true })
    .limit(15);
  if (hiddenVibeIds.length) allQuery = allQuery.not("id", "in", `(${hiddenVibeIds.join(",")})`);

  // Count of vibes in the user's city over the next week — for the hero line.
  const weekIso = new Date(Date.now() + 7 * 864e5).toISOString();
  let cityWeekQuery = supabase
    .from("vibe_directory")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "reviewing", "ranking", "finalized"])
    .gte("starts_at", nowIso)
    .lte("starts_at", weekIso);
  if (homeCity) cityWeekQuery = cityWeekQuery.ilike("city", homeCity);

  const [{ data: nearRaw }, { data: allRaw }, { count: liveCount }] = await Promise.all([
    nearQuery,
    allQuery,
    cityWeekQuery,
  ]);
  const near = (nearRaw ?? []) as VibeRow[];
  const allVibes = (allRaw ?? []) as VibeRow[];

  // One metadata pass over the union of both lists.
  const vibeUnion = Array.from(new Map([...near, ...allVibes].map((v) => [v.id, v])).values());
  const unionIds = vibeUnion.map((v) => v.id);

  const [
    vibeMeta,
    vibeMatch,
    { data: cardInterests },
    { data: flockRows },
    { data: peopleRows },
    { data: buddyPending },
    { data: myConfirmed },
    { data: myVibeReviews },
    activityFeedRes,
    { data: actionNotifs },
    feedRes,
  ] = await Promise.all([
    loadHostsAndCounts(supabase, vibeUnion),
    loadVibeMatch(supabase, unionIds),
    unionIds.length
      ? supabase.from("vibe_interests").select("vibe_id, status").eq("user_id", user!.id).in("vibe_id", unionIds)
      : Promise.resolve({ data: [] }),
    supabase.rpc("home_flocks", { p_limit: 10 }),
    supabase.rpc("city_people", { p_limit: 12 }),
    // Pending reviews: ended 1:1 trips/activities with an unreviewed buddy.
    supabase.rpc("pending_reviews"),
    // Vibes I'm confirmed for (candidates for an event review once they start).
    supabase.from("vibe_interests").select("vibe_id").eq("user_id", user!.id).eq("status", "confirmed"),
    // Vibe reviews I've already left, to exclude them.
    supabase.from("vibe_reviews").select("vibe_id").eq("reviewer_id", user!.id),
    // 1:1 activities posted by others in the city — mixed into the near-you
    // carousel. Migration-safe: errors (RPC not on prod yet) → empty.
    supabase.rpc("activity_feed", { p_limit: 4 }),
    // Actionable notifications (someone wants to join your activity / trip /
    // flock) — surfaced on Home so requests aren't missed in the inbox.
    supabase
      .from("notifications")
      .select("id, type, title, body, data")
      .eq("user_id", user!.id)
      .is("read_at", null)
      .is("dismissed_at", null)
      .in("type", ["activity_like", "trip_join_request", "club_founder_invite", "club_join_prompt", "club_heartbeat"])
      .order("created_at", { ascending: false })
      .limit(4),
    // The city feed — anchored recaps. Migration-safe: RPC missing → empty.
    supabase.rpc("feed_posts", { p_limit: 20 }),
  ]);
  type ActivityFeedRow = {
    activity_id: string;
    title: string | null;
    start_date: string | null;
    end_date: string | null;
    city: string | null;
    cover_photo?: string | null;
    my_request_status?: string | null;
    creator_id: string;
    display_name: string | null;
    age: number | null;
    photo: string | null;
    one_liner: string | null;
    score: number | null;
  };
  const nearActivities: ActivityFeedRow[] = activityFeedRes.error
    ? []
    : ((activityFeedRes.data ?? []) as ActivityFeedRow[]);
  const feedPosts: FeedPost[] = feedRes.error ? [] : ((feedRes.data ?? []) as FeedPost[]);

  // "Needs your action" cards: link each request to where it's handled.
  type ActionNotif = { id: string; type: string; title: string; body: string | null; data: Record<string, string> | null };
  const actionItems = ((actionNotifs ?? []) as ActionNotif[])
    .map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      // Prefer the notification's own destination (join requests point at
      // My Plans → Activities, where Accept/Pass live), then fall back.
      href:
        n.data?.href ??
        (n.type === "trip_join_request" && n.data?.trip_id
          ? `/my-trips#trip-${n.data.trip_id}`
          : n.data?.like_from
            ? `/people/${n.data.like_from}`
            : "/inbox"),
    }));

  const cardStatuses: Record<string, InterestStatus> = {};
  cardInterests?.forEach((r) => {
    cardStatuses[r.vibe_id] = r.status as InterestStatus;
  });

  // ── "Your plans": upcoming Vibes I'm confirmed for (next plan, green) or
  // invited to (confirm your spot). Pinned at the top of Home.
  const { data: myPlanRows } = await supabase
    .from("vibe_interests")
    .select("vibe_id, status")
    .eq("user_id", user!.id)
    .in("status", ["confirmed", "invited"]);
  const planStatus: Record<string, string> = {};
  (myPlanRows ?? []).forEach((r) => (planStatus[r.vibe_id] = r.status));
  const planIds = Object.keys(planStatus);
  type PlanVibe = {
    id: string;
    title: string;
    starts_at: string;
    area: string | null;
    city: string;
    timezone: string | null;
    status: string;
    directionsUrl?: string;
  };
  const mapsUrl = (q: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  let confirmedPlans: PlanVibe[] = [];
  let invitedPlans: PlanVibe[] = [];
  if (planIds.length) {
    const { data: pv } = await supabase
      .from("vibe_directory")
      .select("id, title, starts_at, area, city, timezone, status")
      .in("id", planIds)
      .gt("starts_at", nowIso)
      .neq("status", "cancelled")
      .order("starts_at", { ascending: true });
    const rows = ((pv ?? []) as PlanVibe[]).map((v) => ({ ...v, status: planStatus[v.id] }));
    confirmedPlans = rows.filter((v) => v.status === "confirmed");
    invitedPlans = rows.filter((v) => v.status === "invited");
    // Confirmed attendees get the exact pin (lat/lng) for Directions, not a
    // city text search. Falls back to the venue name, then area/city.
    await Promise.all(
      confirmedPlans.map(async (p) => {
        const { data: logRows } = await supabase.rpc("vibe_private_logistics", { p_vibe: p.id });
        const l = (logRows as
          | { location_name: string | null; location_lat: number | null; location_lng: number | null }[]
          | null)?.[0];
        const q =
          l?.location_lat != null && l?.location_lng != null
            ? `${l.location_lat},${l.location_lng}`
            : l?.location_name || [p.area, p.city].filter(Boolean).join(", ");
        p.directionsUrl = mapsUrl(q);
      })
    );
  }
  const flocks = (flockRows ?? []) as HomeFlock[];
  const people = (peopleRows ?? []) as CityPerson[];
  // "Explore around the world" = vibes outside the user's home city.
  const exploreVibes = homeCity
    ? allVibes.filter((v) => (v.city ?? "").trim().toLowerCase() !== homeCity.toLowerCase())
    : allVibes;

  // ── Consolidated "reviews to leave" count ──────────────────────────────
  // Buddy reviews come from the same RPC the creation gate uses. Vibe reviews:
  // confirmed attendee, the Vibe has started, and I haven't reviewed it yet.
  const buddyPendingList = (buddyPending ?? []) as { buddy_id: string }[];
  const reviewedVibeIds = new Set((myVibeReviews ?? []).map((r) => r.vibe_id));
  const candidateVibeIds = Array.from(
    new Set((myConfirmed ?? []).map((r) => r.vibe_id))
  ).filter((id) => !reviewedVibeIds.has(id));
  let pendingVibeIds: string[] = [];
  if (candidateVibeIds.length) {
    // A Vibe is reviewable once it has started (matches the review page's gate).
    const { data: startedVibes } = await supabase
      .from("vibe_directory")
      .select("id")
      .in("id", candidateVibeIds)
      .lte("starts_at", nowIso);
    pendingVibeIds = (startedVibes ?? []).map((v) => v.id);
  }
  const reviewCount = buddyPendingList.length + pendingVibeIds.length;
  // Link to the first pending item (there's no single review-hub route).
  const firstReviewHref = buddyPendingList.length
    ? `/review/${buddyPendingList[0].buddy_id}`
    : pendingVibeIds.length
      ? `/vibes/${pendingVibeIds[0]}/review`
      : null;

  // ── Local-pool state ───────────────────────────────────────────────────
  // Empty local pool = no activity buddies AND no Vibes in the viewer's city.
  // When true we lead with an encouraging "early city" state instead of letting
  // worldwide carousels imply "everyone is in <another city>".
  const localPoolEmpty =
    !!homeCity && people.length === 0 && near.length === 0 && (liveCount ?? 0) === 0;

  // Cards get a tiny alternating "polaroid" tilt that straightens on hover.
  const vibeCell = (v: VibeRow, i = 0) => {
    const st = cardStatuses[v.id] ?? null;
    const isHostVibe = v.host_id === user!.id;
    // Every card gets a status-appropriate CTA.
    const homeCta = isHostVibe
      ? { label: th("plans.manage"), href: `/vibes/${v.id}`, tone: "muted" as const }
      : st === "confirmed"
        ? { label: th("plans.openChat"), href: `/vibes/${v.id}/chat`, tone: "green" as const }
        : st === "invited"
          ? { label: th("plans.confirm"), href: `/vibes/${v.id}`, tone: "coral" as const }
          : st == null
            ? { label: th("plans.interested"), href: `/vibes/${v.id}?interested=1`, tone: "coral" as const }
            : { label: th("plans.view"), href: `/vibes/${v.id}`, tone: "muted" as const };
    return (
      <div
        key={v.id}
        className={`w-72 shrink-0 snap-start transition-transform duration-200 hover:rotate-0 ${
          i % 2 ? "-rotate-[1.2deg]" : "rotate-[1.2deg]"
        }`}
      >
        <VibeCard
          vibe={{ ...v, host: vibeMeta.hosts[v.host_id] ?? null } as VibeCardData}
          confirmedCount={vibeMeta.counts[v.id] ?? 0}
          myStatus={st}
          match={isHostVibe ? undefined : vibeMatch[v.id]}
          canDismiss={!isHostVibe && !st}
          variant="home"
          homeCta={homeCta}
        />
      </div>
    );
  };

  // 1:1 activity cell — SAME anatomy as the home VibeCard (image on top with
  // a badge overlay, title, coral date, location, match pill, full-width CTA)
  // so the near-you rail reads as one consistent card family.
  const activityCell = (a: (typeof nearActivities)[number], i = 0) => (
    <div
      key={`act-${a.activity_id}`}
      className={`w-72 shrink-0 snap-start transition-transform duration-200 hover:rotate-0 ${
        i % 2 ? "-rotate-[1.2deg]" : "rotate-[1.2deg]"
      }`}
    >
      <div className="relative flex h-full flex-col rounded-3xl border border-ink/10 bg-white p-2 shadow-[0_2px_12px_rgba(10,37,69,0.07)]">
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-cream">
          {a.cover_photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.cover_photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl">🤝</div>
          )}
          <span className="absolute left-2 top-2 rounded-full bg-flockie-blue px-2 py-0.5 text-[10px] font-extrabold leading-none text-white shadow-[0_1px_5px_rgba(10,37,69,0.2)]">
            {th("activityCard.badge")}
          </span>
        </div>

        <div className="flex flex-1 flex-col px-1.5 pt-2.5 pb-1">
          <p className="line-clamp-2 text-[13px] font-extrabold leading-tight text-ink">{a.title}</p>
          {a.start_date && (
            <p className="mt-1 text-[11px] font-bold leading-tight text-flockie-orange">
              {format(new Date(a.start_date), "EEE, MMM d", { locale: dfLocale(locale) })}
            </p>
          )}
          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-muted">
            <MapPin size={11} className="shrink-0" />
            <span className="truncate">{a.city}</span>
          </p>
          <div className="mt-2 flex items-center gap-2">
            {a.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.photo} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-flockie-blue text-[9px] font-bold text-white">
                {(a.display_name ?? "?")[0]?.toUpperCase()}
              </span>
            )}
            <span className="truncate text-[11px] font-bold text-ink/70">{a.display_name}</span>
            {a.score != null && (
              <span className="shrink-0 rounded-full bg-flockie-blue/15 px-2.5 py-1 text-[11px] font-extrabold leading-none text-flockie-blue">
                {Math.round(a.score)}%
              </span>
            )}
          </div>
        </div>

        <div className="mt-2">
          {a.my_request_status === "pending" ? (
            <span className="flex w-full items-center justify-center rounded-xl bg-onboarding-green py-2 text-xs font-extrabold text-white">
              {th("activityCard.requested")}
            </span>
          ) : (
            <JoinActivityButton
              activityId={a.activity_id}
              title={a.title ?? ""}
              creatorName={a.display_name ?? "?"}
            />
          )}
        </div>
      </div>
    </div>
  );

  // Interleave: one 1:1 activity after every two Vibes, leftovers at the end.
  const nearCells: React.ReactNode[] = [];
  {
    let ai = 0;
    near.forEach((v, i) => {
      nearCells.push(vibeCell(v, i));
      if ((i + 1) % 2 === 0 && ai < nearActivities.length) {
        nearCells.push(activityCell(nearActivities[ai], i + ai));
        ai++;
      }
    });
    while (ai < nearActivities.length) {
      nearCells.push(activityCell(nearActivities[ai], ai));
      ai++;
    }
  }

  return (
    <div className="home-stagger pb-24">
      {/* ── Welcome ─────────────────────────────────────────────────────── */}
      <HomeHero
        firstName={firstName}
        homeCity={homeCity}
        liveCount={liveCount ?? 0}
        greetings={{
          morning: t("greeting.morning"),
          afternoon: t("greeting.afternoon"),
          evening: t("greeting.evening"),
        }}
        subline={t("homeSubline")}
      />

      {/* What does the % mean? (dismissible legend) */}
      <MatchKeyTip />

      {/* Reviews to leave (consolidated, session-dismissible) */}
      {firstReviewHref && (
        <ReviewsToDoBanner count={reviewCount} href={firstReviewHref} />
      )}

      {/* ── Your plans: confirm invites + your next confirmed Vibe ───────── */}
      <HomePlans
        invited={invitedPlans.map((p) => ({
          id: p.id,
          title: p.title,
          meta: `${formatVibeWhen(p.starts_at, locale, p.timezone)} · ${p.area || p.city}`,
          href: `/vibes/${p.id}`,
        }))}
        confirmed={confirmedPlans.map((p) => ({
          id: p.id,
          title: p.title,
          meta: `${formatVibeWhen(p.starts_at, locale, p.timezone)} · ${p.area || p.city}`,
          chatUrl: `/vibes/${p.id}/chat`,
          directionsUrl: p.directionsUrl ?? mapsUrl([p.area, p.city].filter(Boolean).join(", ")),
        }))}
        labels={{
          heading: th("plans.heading"),
          invited: th("plans.invited"),
          confirm: th("plans.confirm"),
          youreIn: th("plans.youreIn"),
          openChat: th("plans.openChat"),
          directions: th("plans.directions"),
          dismiss: th("plans.dismiss"),
        }}
      />

      {/* ── Needs your action: join requests on your activities/trips ────── */}
      <HomeActions
        items={actionItems}
        labels={{
          heading: th("actions.heading"),
          review: th("actions.review"),
          dismiss: th("plans.dismiss"),
        }}
      />

      {/* ── Early-city state: lead here when the local pool is empty ─────── */}
      {localPoolEmpty && homeCity && (
        <EarlyCityState
          city={homeCity}
          inviterId={user!.id}
          inviterName={profile?.display_name ?? undefined}
        />
      )}

      {/* ── Find a buddy for an activity (people in your city) ───────────── */}
      {!localPoolEmpty && (
      <section className="mx-4 mt-6">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <h2 className="whitespace-nowrap text-[18px] font-extrabold tracking-tight sm:text-[28px] sm:tracking-normal">
              {t("findBuddyHeading")}
            </h2>
            <Squiggle />
            <p className="mt-0.5 font-bold text-navy/60">
              {th("buddies.subtitle", { city: homeCity ?? th("buddies.yourCity") })}
            </p>
          </div>
          {people.length > 0 && (
            <Link
              href="/match?view=create"
              className="flex shrink-0 items-center gap-1 text-sm font-bold text-flockie-coral"
            >
              {th("buddies.seeMore")} <ArrowRight size={15} />
            </Link>
          )}
        </div>

        {people.length === 0 ? (
          <div className="mt-4 rounded-3xl border-2 border-dashed border-ink/25 bg-white p-6 text-center">
            <p className="font-bold">
              {th("buddies.emptyTitle", { city: homeCity ?? th("buddies.yourCity") })}
            </p>
            <p className="mx-auto mt-1 max-w-xl text-sm font-medium leading-relaxed text-muted">
              {th("buddies.emptyBody")}
            </p>
            <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
              <InviteFriendsButton
                inviterId={user!.id}
                inviterName={profile?.display_name ?? undefined}
                city={homeCity ?? undefined}
                label={th("buddies.inviteFriend")}
              />
              <Link
                href="/vibes"
                className="inline-flex items-center justify-center rounded-full border border-ink/15 bg-white px-5 py-2.5 text-sm font-bold text-ink"
              >
                {th("buddies.exploreVibes")}
              </Link>
            </div>
          </div>
        ) : (
          <div className="carousel-fade mt-4 flex snap-x gap-4 overflow-x-auto pb-3 pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {people.map((p, i) => {
              const name = (p.display_name ?? th("buddies.someone")).split(" ")[0];
              const photo = p.photos?.[0] ?? null;
              const sharedTaste = (p.shared_interests ?? [])
                .map((interest) => INTEREST_LABELS[interest])
                .filter(Boolean)
                .slice(0, 2);
              const sharedStyle = (p.shared_styles ?? [])
                .map((style) => STYLE_LABELS[style])
                .filter(Boolean)
                .slice(0, 2);
              const sharedLabels = (sharedTaste.length ? sharedTaste : sharedStyle).filter(
                (label, index, labels) => labels.indexOf(label) === index
              );
              return (
                <div
                  key={p.id}
                  className={`flex w-40 shrink-0 snap-start flex-col items-center rounded-2xl border border-ink/12 bg-white p-4 text-center shadow-[0_2px_12px_rgba(10,37,69,0.07)] transition-transform duration-200 hover:-translate-y-1 hover:rotate-0 ${
                    i % 2 ? "-rotate-[1.2deg]" : "rotate-[1.2deg]"
                  }`}
                >
                  <Link href={`/people/${p.id}`} className="flex w-full flex-col items-center">
                    <div
                      className="relative h-[88px] w-[88px] rounded-full p-[3px]"
                      style={
                        typeof p.score === "number"
                          ? {
                              background: `conic-gradient(#FF6B4A ${Math.round(p.score) * 3.6}deg, rgba(10,37,69,0.12) 0deg)`,
                            }
                          : undefined
                      }
                    >
                      <div className="relative h-full w-full overflow-hidden rounded-full border border-ink/10 bg-cream">
                        {photo ? (
                          <Image src={photo} alt="" fill sizes="88px" className="object-cover" />
                        ) : (
                          <span className="flex h-full items-center justify-center text-2xl font-black text-flockie-blue">
                            {name[0]}
                          </span>
                        )}
                      </div>
                      {typeof p.score === "number" && (
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-ink/15 bg-flockie-coral px-1.5 text-[10px] font-extrabold leading-tight text-white">
                          {Math.round(p.score)}%
                        </span>
                      )}
                    </div>
                    <p className="mt-3 w-full truncate text-sm font-extrabold">
                      {name}
                      {p.age ? `, ${p.age}` : ""}
                    </p>
                    {sharedLabels.length > 0 && (
                      <p className="mt-0.5 line-clamp-1 w-full text-[11px] font-bold text-flockie-blue">
                        {th("buddies.shared", { items: sharedLabels.join(" · ") })}
                      </p>
                    )}
                    {p.one_liner && (
                      <p className="mt-0.5 line-clamp-2 text-xs font-medium text-muted">{p.one_liner}</p>
                    )}
                  </Link>
                  <SayHiButton personId={p.id} personName={name} />
                </div>
              );
            })}
          </div>
        )}
      </section>
      )}

      {/* ── Happening near you (same city + filters) ────────────────────── */}
      <section className="relative mx-4 mt-8 overflow-hidden rounded-3xl bg-flockie-blue p-5 text-white shadow-[0_16px_32px_-10px_rgba(77,168,218,0.55)] sm:p-6">
        {/* Crisp confetti — small sharp dots/sparkles in the corners, kept away
            from the text and cards. */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <span className="absolute right-8 top-5 h-2 w-2 rounded-full bg-white/40" />
          <span className="absolute right-16 top-10 h-1.5 w-1.5 rounded-full bg-flockie-coral/70" />
          <span className="absolute right-28 top-4 text-sm text-white/50">✦</span>
          <span className="absolute bottom-4 left-6 h-1.5 w-1.5 rounded-full bg-white/35" />
          <span className="absolute bottom-8 right-6 text-xs text-flockie-coral/60">✦</span>
        </div>
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-extrabold sm:text-[28px]">{th("nearYou.heading")}</h2>
            <Squiggle color="rgba(255,255,255,0.75)" />
            <p className="mt-0.5 font-bold text-white/80">
              {th(`nearYou.subtitle.${timingKey}.${cityVariant}`, { city: homeCity ?? "" })}
            </p>
          </div>
          <SeeAllNearYou />
        </div>

        {near.length === 0 && nearActivities.length === 0 ? (
          <div className="mt-3 flex flex-col items-center gap-2 rounded-2xl border-2 border-white/40 bg-white/10 p-4 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="text-sm font-bold">
              {th(`nearYou.empty.${timingKey}.${cityVariant}`, { city: homeCity ?? "" })}
            </p>
            <Link
              href="/vibes/new"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-ink/15 bg-flockie-coral px-4 py-1.5 text-sm font-bold text-white"
            >
              <Plus size={14} /> {th("nearYou.createVibe")}
            </Link>
          </div>
        ) : (
          <div className="carousel-fade mt-4 flex snap-x gap-4 overflow-x-auto pb-3 pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {nearCells}
          </div>
        )}
      </section>

      {/* ── The feed: recaps of real vibes, clubs & activities. Same-width
          panel as the near-you box, with its own internal scroll. ── */}
      <section className="relative mx-4 mt-8 overflow-hidden rounded-3xl border border-ink/10 bg-cream p-5 shadow-[0_2px_12px_rgba(10,37,69,0.07)] sm:p-6">
        {/* Crisp confetti — same accent language as the blue near-you panel. */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <span className="absolute right-7 top-4 text-sm text-flockie-coral/60">✦</span>
          <span className="absolute right-16 top-9 h-2 w-2 rounded-full bg-flockie-blue/50" />
          <span className="absolute bottom-5 left-5 h-1.5 w-1.5 rounded-full bg-flockie-coral/50" />
          <span className="absolute bottom-9 right-8 text-xs text-flockie-blue/50">✦</span>
        </div>
        <div className="relative px-1">
          <h2 className="text-[22px] font-extrabold sm:text-[28px]">📸 {th("feed.heading")}</h2>
          <Squiggle color="#FF6B4A" />
          <p className="mt-0.5 font-bold text-navy/60">
            {th("feed.subtitle", { city: homeCity ?? th("buddies.yourCity") })}
          </p>
        </div>
        <div className="carousel-fade relative mt-4 max-h-[560px] overflow-y-auto pr-1 [scrollbar-width:thin]">
          <div className="mx-auto max-w-xl">
            <FeedSection
              posts={feedPosts}
              meId={user!.id}
              mePhoto={(profile?.photos as string[] | null)?.[0] ?? null}
            />
          </div>
        </div>
      </section>

      {/* ── Didn't find what you're looking for? ────────────────────────── */}
      <section className="mx-4 mt-8 rounded-3xl border border-ink/10 bg-cream p-5 sm:p-6">
        <h2 className="text-[22px] font-extrabold sm:text-[26px]">
          {th("notFound.heading")}
        </h2>
        <p className="mt-0.5 font-bold text-ink/60">
          {vibeFormDone ? th("notFound.subtitleDone") : th("notFound.subtitleTodo")}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {!vibeFormDone && (
            <Link
              href="/onboarding/vibe-check"
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-ink/15 bg-ink px-5 py-3 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] transition-transform hover:-translate-y-0.5 sm:col-span-2"
            >
              {th("notFound.completeVibeCheck")}
            </Link>
          )}
          <Link
            href="/vibes/new"
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-ink/15 bg-flockie-coral px-5 py-3 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] transition-transform hover:-translate-y-0.5"
          >
            <Plus size={18} /> {th("notFound.createVibe")}
          </Link>
          <Link
            href="/match/trip?kind=activity"
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-ink/15 bg-flockie-blue px-5 py-3 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] transition-transform hover:-translate-y-0.5"
          >
            <Plus size={18} /> {th("notFound.createActivity")}
          </Link>
        </div>
      </section>
    </div>
  );
}
