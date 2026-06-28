import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPin, Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import VibeCard, { type VibeCardData } from "@/components/VibeCard";
import FlockRequestButton from "@/components/FlockRequestButton";
import SayHiButton from "@/components/SayHiButton";
import HomeHero from "@/components/HomeHero";
import CreateFab from "@/components/CreateFab";
import MatchKeyTip from "@/components/MatchKeyTip";
import InviteFriendsButton from "@/components/InviteFriendsButton";
import { loadVibeMatch } from "@/lib/vibe-stats";
import { type InterestStatus } from "@/lib/vibes";

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
  "id, host_id, title, category, photos, city, area, country, starts_at, capacity, event_vibe_tags";

async function loadHostsAndCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  list: { id: string; host_id: string }[]
) {
  const hosts: Record<string, { display_name: string | null; photos: string[] | null }> = {};
  const counts: Record<string, number> = {};
  const hostIds = Array.from(new Set(list.map((v) => v.host_id)));
  const ids = list.map((v) => v.id);

  const [hostResult, confirmedResult] = await Promise.all([
    hostIds.length
      ? supabase.from("public_profiles").select("id, display_name, photos").in("id", hostIds)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("vibe_interests").select("vibe_id").eq("status", "confirmed").in("vibe_id", ids)
      : Promise.resolve({ data: [] }),
  ]);

  hostResult.data?.forEach((h) => (hosts[h.id] = { display_name: h.display_name, photos: h.photos }));
  confirmedResult.data?.forEach((r) => (counts[r.vibe_id] = (counts[r.vibe_id] ?? 0) + 1));
  return { hosts, counts };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: { when?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const nowIso = new Date().toISOString();

  const [{ data: profile }, { data: hiddenRows }] = await Promise.all([
    supabase.from("profiles").select("display_name, home_city, vibe_completed_at").eq("id", user!.id).maybeSingle(),
    supabase.from("vibe_feedback").select("vibe_id").eq("user_id", user!.id).eq("signal", "not_for_me"),
  ]);

  const firstName = (profile?.display_name?.trim() || "there").split(" ")[0];
  const homeCity = profile?.home_city?.trim() || null;
  const vibeFormDone = !!profile?.vibe_completed_at;
  const timing = searchParams.when === "24" ? "24" : searchParams.when === "48" ? "48" : "all";
  const cutoffHours = timing === "24" ? 24 : timing === "48" ? 48 : null;
  const timingLabel =
    timing === "24" ? "in the next 24 hours" : timing === "48" ? "in the next 48 hours" : "upcoming";
  const hiddenVibeIds = Array.from(new Set((hiddenRows ?? []).map((r) => r.vibe_id)));

  // ── Vibes: "near you" (same city + timing filter) and "all cities" ─────
  let nearQuery = supabase
    .from("vibe_directory")
    .select(VIBE_COLS)
    .in("status", ["open", "ranking", "finalized"])
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
    .in("status", ["open", "ranking", "finalized"])
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true })
    .limit(15);
  if (hiddenVibeIds.length) allQuery = allQuery.not("id", "in", `(${hiddenVibeIds.join(",")})`);

  // Count of vibes in the user's city over the next week — for the hero line.
  const weekIso = new Date(Date.now() + 7 * 864e5).toISOString();
  let cityWeekQuery = supabase
    .from("vibe_directory")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "ranking", "finalized"])
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

  const [vibeMeta, vibeMatch, { data: cardInterests }, { data: flockRows }, { data: peopleRows }] =
    await Promise.all([
      loadHostsAndCounts(supabase, vibeUnion),
      loadVibeMatch(supabase, unionIds),
      unionIds.length
        ? supabase.from("vibe_interests").select("vibe_id, status").eq("user_id", user!.id).in("vibe_id", unionIds)
        : Promise.resolve({ data: [] }),
      supabase.rpc("home_flocks", { p_limit: 10 }),
      supabase.rpc("city_people", { p_limit: 12 }),
    ]);

  const cardStatuses: Record<string, InterestStatus> = {};
  cardInterests?.forEach((r) => {
    cardStatuses[r.vibe_id] = r.status as InterestStatus;
  });
  const flocks = (flockRows ?? []) as HomeFlock[];
  const people = (peopleRows ?? []) as CityPerson[];
  // "Explore around the world" = vibes outside the user's home city.
  const exploreVibes = homeCity
    ? allVibes.filter((v) => (v.city ?? "").trim().toLowerCase() !== homeCity.toLowerCase())
    : allVibes;

  const vibeCell = (v: VibeRow) => (
    <div key={v.id} className="w-72 shrink-0 snap-start">
      <VibeCard
        vibe={{ ...v, host: vibeMeta.hosts[v.host_id] ?? null } as VibeCardData}
        confirmedCount={vibeMeta.counts[v.id] ?? 0}
        myStatus={cardStatuses[v.id] ?? null}
        matchPct={vibeMatch[v.id]}
        canDismiss={v.host_id !== user!.id && !cardStatuses[v.id]}
      />
    </div>
  );

  return (
    <div className="home-stagger pb-24">
      {/* ── Welcome ─────────────────────────────────────────────────────── */}
      <HomeHero firstName={firstName} homeCity={homeCity} liveCount={liveCount ?? 0} />

      {/* What does the % mean? (dismissible legend) */}
      <MatchKeyTip />

      {/* ── Find a buddy for an activity (people in your city) ───────────── */}
      <section className="mx-4 mt-6">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[22px] font-extrabold sm:text-[28px]">Find a buddy for an activity</h2>
              <span className="-rotate-6 rounded-full border-2 border-ink bg-flockie-coral px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-[0_2px_0_0_rgba(10,37,69,1)]">
                ✨ Top picks
              </span>
            </div>
            <p className="mt-0.5 font-bold text-navy/60">
              People in {homeCity ?? "your city"} up for doing something — say hi.
            </p>
          </div>
          {people.length > 0 && (
            <Link
              href="/match?mode=activity"
              className="flex shrink-0 items-center gap-1 text-sm font-bold text-flockie-coral"
            >
              Swipe more <ArrowRight size={15} />
            </Link>
          )}
        </div>

        {people.length === 0 ? (
          <div className="mt-4 rounded-3xl border-2 border-dashed border-ink/25 bg-white p-6 text-center">
            <p className="font-bold">
              No new activity buddies in {homeCity ?? "your city"} right now.
            </p>
            <p className="mx-auto mt-1 max-w-xl text-sm font-medium leading-relaxed text-muted">
              Creating an activity won’t produce a match until someone compatible
              is available. Invite a friend or explore Vibes while the local pool grows.
            </p>
            <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
              <InviteFriendsButton
                inviterId={user!.id}
                inviterName={profile?.display_name ?? undefined}
                city={homeCity ?? undefined}
                label="Invite a friend"
              />
              <Link
                href="/vibes"
                className="inline-flex items-center justify-center rounded-full border-2 border-ink bg-white px-5 py-2.5 text-sm font-bold text-ink"
              >
                Explore Vibes
              </Link>
            </div>
          </div>
        ) : (
          <div className="carousel-fade mt-4 flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {people.map((p) => {
              const name = (p.display_name ?? "Someone").split(" ")[0];
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
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border-2 border-ink bg-flockie-blue px-1.5 text-[10px] font-extrabold leading-tight text-white">
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

      {/* ── Join a vibe (all cities) ────────────────────────────────────── */}
      <section className="mx-4 mt-8 px-1">
        <h2 className="text-[22px] font-extrabold sm:text-[28px]">Join a vibe</h2>
        <p className="mt-0.5 font-bold text-navy/60">Group plans everywhere — jump into one.</p>
      </section>

      {/* ── Happening near you (same city + filters) ────────────────────── */}
      <section className="mx-4 mt-4 rounded-3xl border-[3px] border-ink bg-flockie-blue p-5 text-white sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2.5 py-1 text-xs font-extrabold text-ink">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flockie-coral opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-flockie-coral" />
            </span>
            {homeCity ?? "Near you"} · live now
          </span>
          <Link
            href="/vibes"
            className="flex shrink-0 items-center gap-1 rounded-full border-2 border-ink bg-white px-3 py-1.5 text-sm font-bold text-ink"
          >
            See all <ArrowRight size={15} />
          </Link>
        </div>

        <h2 className="mt-3 text-[22px] font-extrabold sm:text-[28px]">Happening near you</h2>
        <p className="mt-0.5 font-bold text-white/80">
          {homeCity ? `${timingLabel} in ${homeCity}` : `${timingLabel} Vibes`}
        </p>

        <div className="mt-3 inline-flex gap-1 rounded-full border-2 border-ink bg-white/15 p-0.5 text-xs font-bold">
          {[
            { value: "all", label: "Any time", href: "/home" },
            { value: "24", label: "24h", href: "/home?when=24" },
            { value: "48", label: "48h", href: "/home?when=48" },
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
              No Vibes {timingLabel}
              {homeCity ? ` in ${homeCity}` : ""} yet. Make the first move 👇
            </p>
            <Link
              href="/vibes/new"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border-2 border-ink bg-flockie-coral px-4 py-1.5 text-sm font-bold text-white"
            >
              <Plus size={14} /> Create a Vibe
            </Link>
          </div>
        ) : (
          <div className="carousel-fade mt-4 flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {near.map(vibeCell)}
          </div>
        )}
      </section>

      {/* ── Explore vibes around the world (other cities) ───────────────── */}
      {exploreVibes.length > 0 && (
        <section className="mx-4 mt-8">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <h2 className="text-[22px] font-extrabold sm:text-[28px]">Explore vibes around the world</h2>
              <p className="mt-0.5 font-bold text-navy/60">Group plans in other cities — jump into one.</p>
            </div>
            <Link
              href="/vibes"
              className="flex shrink-0 items-center gap-1 text-sm font-bold text-flockie-coral"
            >
              See all <ArrowRight size={15} />
            </Link>
          </div>
          <div className="carousel-fade mt-4 flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {exploreVibes.map(vibeCell)}
          </div>
        </section>
      )}

      {/* ── Find a flock (newest open group trips) ──────────────────────── */}
      <section className="mx-4 mt-8">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <h2 className="text-[22px] font-extrabold sm:text-[28px]">Find a flock</h2>
            <p className="mt-0.5 font-bold text-navy/60">Newest open group trips you can join.</p>
          </div>
          <Link
            href="/flocks"
            className="flex shrink-0 items-center gap-1 text-sm font-bold text-flockie-coral"
          >
            See all <ArrowRight size={15} />
          </Link>
        </div>

        {flocks.length === 0 ? (
          <div className="mt-4 rounded-3xl border-2 border-dashed border-ink/25 bg-white p-6 text-center">
            <p className="font-bold">No open flocks right now.</p>
            <p className="mt-1 text-sm font-medium text-muted">Start one and let travelers request in.</p>
            <Link
              href="/match/trip?kind=flock"
              className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-flockie-blue px-5 py-2 text-sm font-bold text-white"
            >
              Create a flock <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <div className="carousel-fade mt-4 flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {flocks.map((f) => {
              const dest = (f.destinations ?? [f.destination]).filter(Boolean).join(" · ") || "Trip";
              const hostName = f.host_name || "Host";
              return (
                <div
                  key={f.id}
                  className="flex w-56 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border-[3px] border-ink bg-white shadow-[0_5px_0_0_rgba(10,37,69,1)] transition-transform hover:-translate-y-1"
                >
                  <div className="relative aspect-[4/3] w-full border-b-2 border-ink bg-cream">
                    {f.cover_photo ? (
                      <Image src={f.cover_photo} alt="" fill sizes="224px" className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-4xl">🧳</div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <p className="flex items-start gap-1 text-sm font-extrabold leading-tight">
                      <MapPin size={13} className="mt-0.5 shrink-0 text-flockie-coral" />
                      <span className="line-clamp-2">{dest}</span>
                    </p>
                    <p className="mt-1 text-xs font-medium text-muted">
                      {f.start_date} → {f.end_date}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs font-bold text-navy/70">
                      <Users size={11} /> {f.going}/{f.group_size} · {hostName}
                    </p>
                    <div className="mt-2.5">
                      <FlockRequestButton tripId={f.id} requested={f.requested} compact />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Didn't find what you're looking for? ────────────────────────── */}
      <section className="mx-4 mt-8 rounded-3xl border-[3px] border-ink bg-cream p-5 sm:p-6">
        <h2 className="text-[22px] font-extrabold sm:text-[26px]">
          Didn&rsquo;t find what you&rsquo;re looking for?
        </h2>
        <p className="mt-0.5 font-bold text-ink/60">
          {vibeFormDone
            ? "Start your own and let your people come to you."
            : "Finish your vibe check and we’ll match you to the right people and Vibes."}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {!vibeFormDone && (
            <Link
              href="/onboarding/vibe-check"
              className="flex items-center justify-center gap-2 rounded-2xl border-[3px] border-ink bg-ink px-5 py-3 font-bold text-white shadow-[0_4px_0_0_rgba(10,37,69,0.45)] transition-transform hover:-translate-y-0.5 sm:col-span-2"
            >
              ✨ Complete your vibe check
            </Link>
          )}
          <Link
            href="/vibes/new"
            className="flex items-center justify-center gap-2 rounded-2xl border-[3px] border-ink bg-flockie-coral px-5 py-3 font-bold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)] transition-transform hover:-translate-y-0.5"
          >
            <Plus size={18} /> Create a vibe
          </Link>
          <Link
            href="/match/trip?kind=activity"
            className="flex items-center justify-center gap-2 rounded-2xl border-[3px] border-ink bg-flockie-blue px-5 py-3 font-bold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)] transition-transform hover:-translate-y-0.5"
          >
            <Plus size={18} /> Create an activity
          </Link>
        </div>
      </section>

      <CreateFab />
    </div>
  );
}
