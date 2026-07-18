import Link from "next/link";
import Image from "next/image";
import { getTranslations, getLocale } from "next-intl/server";
import { ArrowRight, MapPin, MessageCircle, Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import VibeCard, { type VibeCardData } from "@/components/VibeCard";
import SayHiButton from "@/components/SayHiButton";
import HomeHero from "@/components/HomeHero";
import CreateFab from "@/components/CreateFab";
import MatchKeyTip from "@/components/MatchKeyTip";
import InviteFriendsButton from "@/components/InviteFriendsButton";
import ReviewsToDoBanner from "@/components/ReviewsToDoBanner";
import EarlyCityState from "@/components/EarlyCityState";
import { loadVibeMatch } from "@/lib/vibe-stats";
import { formatVibeWhen, type InterestStatus } from "@/lib/vibes";

type CityPerson = {
  id: string;
  display_name: string | null;
  age: number | null;
  photos: string[] | null;
  one_liner: string | null;
  home_city: string | null;
  score: number | null;
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
    supabase.from("profiles").select("display_name, home_city, vibe_completed_at").eq("id", user!.id).maybeSingle(),
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
  ]);

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
  };
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
  }
  const mapsUrl = (q: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
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

  const vibeCell = (v: VibeRow) => {
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
      <div key={v.id} className="w-72 shrink-0 snap-start">
        <VibeCard
          vibe={{ ...v, host: vibeMeta.hosts[v.host_id] ?? null } as VibeCardData}
          confirmedCount={vibeMeta.counts[v.id] ?? 0}
          myStatus={st}
          matchPct={isHostVibe ? undefined : vibeMatch[v.id]}
          canDismiss={!isHostVibe && !st}
          variant="home"
          homeCta={homeCta}
        />
      </div>
    );
  };

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
      {(invitedPlans.length > 0 || confirmedPlans.length > 0) && (
        <section className="mx-4 mt-6 space-y-3">
          <h2 className="px-1 text-[22px] font-extrabold sm:text-[28px]">{th("plans.heading")}</h2>
          {invitedPlans.map((p) => (
            <div key={p.id} className="rounded-2xl border-2 border-flockie-coral bg-white p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-flockie-coral/10 text-lg">
                  ✉️
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">
                    {th("plans.invited")} · {p.title}
                  </p>
                  <p className="truncate text-xs font-medium text-muted">
                    {formatVibeWhen(p.starts_at, locale, p.timezone)} · {p.area || p.city}
                  </p>
                </div>
                <Link
                  href={`/vibes/${p.id}`}
                  className="shrink-0 rounded-full border-2 border-ink bg-flockie-coral px-4 py-2 text-xs font-bold text-white shadow-[0_2px_0_0_#E0512C]"
                >
                  {th("plans.confirm")}
                </Link>
              </div>
            </div>
          ))}
          {confirmedPlans.map((p) => (
            <div key={p.id} className="rounded-2xl border-2 border-onboarding-green bg-[#E9F6F1] p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-onboarding-green/15 text-lg">
                  🎉
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">{p.title}</p>
                  <p className="truncate text-xs font-medium text-muted">
                    {formatVibeWhen(p.starts_at, locale, p.timezone)} · {p.area || p.city}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-onboarding-green px-2.5 py-1 text-[11px] font-extrabold text-white">
                  {th("plans.youreIn")}
                </span>
              </div>
              <div className="mt-2.5 flex gap-2">
                <Link
                  href={`/vibes/${p.id}/chat`}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 border-ink bg-white py-2 text-xs font-bold text-ink"
                >
                  <MessageCircle size={14} /> {th("plans.openChat")}
                </Link>
                <a
                  href={mapsUrl([p.area, p.city].filter(Boolean).join(", "))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 border-ink bg-white py-2 text-xs font-bold text-ink"
                >
                  <MapPin size={14} /> {th("plans.directions")}
                </a>
              </div>
            </div>
          ))}
        </section>
      )}

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
            <div className="flex items-center gap-2">
              <h2 className="text-[22px] font-extrabold sm:text-[28px]">{t("findBuddyHeading")}</h2>
              <span className="-rotate-6 rounded-full border-2 border-ink bg-flockie-coral px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-[0_2px_0_0_rgba(10,37,69,1)]">
                {th("buddies.topPicks")}
              </span>
            </div>
            <p className="mt-0.5 font-bold text-navy/60">
              {th("buddies.subtitle", { city: homeCity ?? th("buddies.yourCity") })}
            </p>
          </div>
          {people.length > 0 && (
            <Link
              href="/match?mode=activity"
              className="flex shrink-0 items-center gap-1 text-sm font-bold text-flockie-coral"
            >
              {th("buddies.swipeMore")} <ArrowRight size={15} />
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
                className="inline-flex items-center justify-center rounded-full border-2 border-ink bg-white px-5 py-2.5 text-sm font-bold text-ink"
              >
                {th("buddies.exploreVibes")}
              </Link>
            </div>
          </div>
        ) : (
          <div className="carousel-fade mt-4 flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {people.map((p) => {
              const name = (p.display_name ?? th("buddies.someone")).split(" ")[0];
              const photo = p.photos?.[0] ?? null;
              return (
                <div
                  key={p.id}
                  className="flex w-40 shrink-0 snap-start flex-col items-center rounded-2xl border-[3px] border-ink bg-white p-4 text-center shadow-[0_5px_0_0_rgba(10,37,69,1)] transition-transform hover:-translate-y-1"
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
                      <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-ink bg-cream">
                        {photo ? (
                          <Image src={photo} alt="" fill sizes="88px" className="object-cover" />
                        ) : (
                          <span className="flex h-full items-center justify-center text-2xl font-black text-flockie-blue">
                            {name[0]}
                          </span>
                        )}
                      </div>
                      {typeof p.score === "number" && (
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border-2 border-ink bg-flockie-coral px-1.5 text-[10px] font-extrabold leading-tight text-white">
                          {Math.round(p.score)}%
                        </span>
                      )}
                    </div>
                    <p className="mt-3 w-full truncate text-sm font-extrabold">
                      {name}
                      {p.age ? `, ${p.age}` : ""}
                    </p>
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

      {/* ── Join a vibe (all cities) ────────────────────────────────────── */}
      <section className="mx-4 mt-8 px-1">
        <h2 className="text-[22px] font-extrabold sm:text-[28px]">{th("joinVibe.heading")}</h2>
        <p className="mt-0.5 font-bold text-navy/60">{th("joinVibe.subtitle")}</p>
      </section>

      {/* ── Happening near you (same city + filters) ────────────────────── */}
      <section className="mx-4 mt-4 rounded-3xl border-[3px] border-ink bg-flockie-blue p-5 text-white sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2.5 py-1 text-xs font-extrabold text-ink">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flockie-coral opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-flockie-coral" />
            </span>
            {homeCity ?? th("nearYou.nearYouFallback")} · {th("nearYou.liveNow")}
          </span>
          <Link
            href="/vibes"
            className="flex shrink-0 items-center gap-1 rounded-full border-2 border-ink bg-white px-3 py-1.5 text-sm font-bold text-ink"
          >
            {th("seeAll")} <ArrowRight size={15} />
          </Link>
        </div>

        <h2 className="mt-3 text-[22px] font-extrabold sm:text-[28px]">{th("nearYou.heading")}</h2>
        <p className="mt-0.5 font-bold text-white/80">
          {th(`nearYou.subtitle.${timingKey}.${cityVariant}`, { city: homeCity ?? "" })}
        </p>

        <div className="mt-3 inline-flex gap-1 rounded-full border-2 border-ink bg-white/15 p-0.5 text-xs font-bold">
          {[
            { value: "all", label: th("nearYou.filterAny"), href: "/home" },
            { value: "24", label: th("nearYou.filter24"), href: "/home?when=24" },
            { value: "48", label: th("nearYou.filter48"), href: "/home?when=48" },
          ].map((option) => (
            <Link
              key={option.value}
              href={option.href}
              className={`rounded-full px-3 py-1 transition-colors ${
                timing === option.value ? "bg-white text-ink" : "text-white hover:bg-white/10"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>

        {near.length === 0 ? (
          <div className="mt-3 flex flex-col items-center gap-2 rounded-2xl border-2 border-white/40 bg-white/10 p-4 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="text-sm font-bold">
              {th(`nearYou.empty.${timingKey}.${cityVariant}`, { city: homeCity ?? "" })}
            </p>
            <Link
              href="/vibes/new"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border-2 border-ink bg-flockie-coral px-4 py-1.5 text-sm font-bold text-white"
            >
              <Plus size={14} /> {th("nearYou.createVibe")}
            </Link>
          </div>
        ) : (
          <div className="carousel-fade mt-4 flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {near.map(vibeCell)}
          </div>
        )}
      </section>

      {/* ── Didn't find what you're looking for? ────────────────────────── */}
      <section className="mx-4 mt-8 rounded-3xl border-[3px] border-ink bg-cream p-5 sm:p-6">
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
              className="flex items-center justify-center gap-2 rounded-2xl border-[3px] border-ink bg-ink px-5 py-3 font-bold text-white shadow-[0_4px_0_0_rgba(10,37,69,0.45)] transition-transform hover:-translate-y-0.5 sm:col-span-2"
            >
              {th("notFound.completeVibeCheck")}
            </Link>
          )}
          <Link
            href="/vibes/new"
            className="flex items-center justify-center gap-2 rounded-2xl border-[3px] border-ink bg-flockie-coral px-5 py-3 font-bold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)] transition-transform hover:-translate-y-0.5"
          >
            <Plus size={18} /> {th("notFound.createVibe")}
          </Link>
          <Link
            href="/match/trip?kind=activity"
            className="flex items-center justify-center gap-2 rounded-2xl border-[3px] border-ink bg-flockie-blue px-5 py-3 font-bold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)] transition-transform hover:-translate-y-0.5"
          >
            <Plus size={18} /> {th("notFound.createActivity")}
          </Link>
        </div>
      </section>

      <CreateFab />
    </div>
  );
}
