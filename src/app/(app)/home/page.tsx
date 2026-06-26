import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import VibeCard, { type VibeCardData } from "@/components/VibeCard";
import { loadVibeMatch } from "@/lib/vibe-stats";
import { type InterestStatus } from "@/lib/vibes";

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
      ? supabase.from("profiles").select("id, display_name, photos").in("id", hostIds)
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
    supabase.from("profiles").select("display_name, home_city").eq("id", user!.id).maybeSingle(),
    supabase.from("vibe_feedback").select("vibe_id").eq("user_id", user!.id).eq("signal", "not_for_me"),
  ]);

  const firstName = (profile?.display_name?.trim() || "there").split(" ")[0];
  const homeCity = profile?.home_city?.trim() || null;
  const timing = searchParams.when === "24" ? "24" : searchParams.when === "48" ? "48" : "all";
  const cutoffHours = timing === "24" ? 24 : timing === "48" ? 48 : null;
  const timingLabel =
    timing === "24" ? "in the next 24 hours" : timing === "48" ? "in the next 48 hours" : "upcoming";
  const hiddenVibeIds = Array.from(new Set((hiddenRows ?? []).map((r) => r.vibe_id)));

  // ── Vibes happening near you ───────────────────────────────────────────
  let nearQuery = supabase
    .from("vibes")
    .select(
      "id, host_id, title, category, photos, city, location_name, starts_at, capacity, event_vibe_tags"
    )
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
  const { data: nearRaw } = await nearQuery;
  const near = nearRaw ?? [];

  const nearIds = near.map((v) => v.id);
  const [nearMeta, nearMatch, { data: cardInterests }] = await Promise.all([
    loadHostsAndCounts(supabase, near),
    loadVibeMatch(supabase, nearIds),
    nearIds.length
      ? supabase.from("vibe_interests").select("vibe_id, status").eq("user_id", user!.id).in("vibe_id", nearIds)
      : Promise.resolve({ data: [] }),
  ]);
  const cardStatuses: Record<string, InterestStatus> = {};
  cardInterests?.forEach((r) => {
    cardStatuses[r.vibe_id] = r.status as InterestStatus;
  });

  return (
    <div className="pb-4">
      {/* ── Welcome ─────────────────────────────────────────────────────── */}
      <section className="px-5 pt-10 text-center sm:pt-14">
        <h1 className="text-[32px] font-black leading-tight sm:text-5xl">Hey {firstName} 👋</h1>
        <p className="mt-2 text-lg font-bold text-ink/70">What do you want to do today?</p>
      </section>

      {/* ── Intent picker ───────────────────────────────────────────────── */}
      <section className="mx-4 mt-5 grid gap-4 sm:grid-cols-2">
        <Link
          href="/match?mode=activity"
          className="rounded-3xl border-[3px] border-ink bg-flockie-blue p-5 text-white shadow-[0_5px_0_0_rgba(10,37,69,1)] transition-transform hover:-translate-y-1"
        >
          <p className="text-3xl">🧭</p>
          <h2 className="mt-2 text-lg font-extrabold">Find a buddy for an activity</h2>
          <p className="mt-1 text-sm font-medium text-white/90">
            Get matched 1:1 with someone to do it with — coffee, surf, a hike.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-bold text-ink">
            Find a buddy <ArrowRight size={15} />
          </span>
        </Link>

        <Link
          href="/vibes"
          className="rounded-3xl border-[3px] border-ink bg-flockie-coral p-5 text-white shadow-[0_5px_0_0_rgba(10,37,69,1)] transition-transform hover:-translate-y-1"
        >
          <p className="text-3xl">🎟️</p>
          <h2 className="mt-2 text-lg font-extrabold">Join a vibe</h2>
          <p className="mt-1 text-sm font-medium text-white/90">
            Hop into a group plan that&rsquo;s already happening near you.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-bold text-ink">
            Browse vibes <ArrowRight size={15} />
          </span>
        </Link>
      </section>

      {/* ── Happening near you ──────────────────────────────────────────── */}
      <section className="mx-4 mt-6 rounded-3xl border-[3px] border-ink bg-flockie-blue p-5 text-white sm:p-6">
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

        <div className="mt-4 grid grid-cols-3 gap-1 rounded-full border-2 border-ink bg-white/15 p-1 text-center text-xs font-bold">
          {[
            { value: "all", label: "Any time", href: "/home" },
            { value: "24", label: "Next 24h", href: "/home?when=24" },
            { value: "48", label: "Next 48h", href: "/home?when=48" },
          ].map((option) => (
            <Link
              key={option.value}
              href={option.href}
              className={`rounded-full px-2 py-2 transition-colors ${
                timing === option.value ? "bg-white text-ink" : "text-white hover:bg-white/10"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>

        {near.length === 0 ? (
          <div className="mt-4 rounded-2xl border-2 border-white/40 bg-white/10 p-6 text-center">
            <p className="font-bold">
              No Vibes {timingLabel}
              {homeCity ? ` in ${homeCity}` : ""} yet.
            </p>
            <p className="mt-1 text-sm font-medium text-white/80">Be the one who starts something.</p>
            <Link
              href="/vibes/new"
              className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-flockie-coral px-5 py-2 text-sm font-bold text-white"
            >
              Create a Vibe
            </Link>
          </div>
        ) : (
          <div className="mt-4 flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {near.map((v) => (
              <div key={v.id} className="w-72 shrink-0 snap-start">
                <VibeCard
                  vibe={{ ...v, host: nearMeta.hosts[v.host_id] ?? null } as VibeCardData}
                  confirmedCount={nearMeta.counts[v.id] ?? 0}
                  myStatus={cardStatuses[v.id] ?? null}
                  matchPct={nearMatch[v.id]}
                  canDismiss={v.host_id !== user!.id && !cardStatuses[v.id]}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Didn't find what you're looking for? ────────────────────────── */}
      <section className="mx-4 mt-6 rounded-3xl border-[3px] border-ink bg-cream p-5 sm:p-6">
        <h2 className="text-[22px] font-extrabold sm:text-[26px]">
          Didn&rsquo;t find what you&rsquo;re looking for?
        </h2>
        <p className="mt-0.5 font-bold text-ink/60">Start your own and let your people come to you.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
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

      {/* ── Find your people (kept) ─────────────────────────────────────── */}
      <section className="mx-4 mt-6">
        <h2 className="px-1 text-[22px] font-extrabold text-navy sm:text-[28px]">Find your people</h2>
        <p className="px-1 font-bold text-navy/60">A 1:1 travel buddy, or a whole group to go with.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Link
            href="/match"
            className="rounded-3xl border-[3px] border-ink bg-flockie-blue p-5 text-white shadow-[0_5px_0_0_rgba(10,37,69,1)] transition-transform hover:-translate-y-1"
          >
            <p className="text-3xl">🧳</p>
            <h3 className="mt-2 text-lg font-extrabold">Find a Buddy</h3>
            <p className="mt-1 text-sm font-medium text-white/90">
              Swipe vibe-matched people for a trip or an activity in your city.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-bold text-ink">
              Start matching <ArrowRight size={15} />
            </span>
          </Link>

          <Link
            href="/flocks"
            className="rounded-3xl border-[3px] border-ink bg-flockie-coral p-5 text-white shadow-[0_5px_0_0_rgba(10,37,69,1)] transition-transform hover:-translate-y-1"
          >
            <p className="text-3xl">🪺</p>
            <h3 className="mt-2 text-lg font-extrabold">Find a flock</h3>
            <p className="mt-1 text-sm font-medium text-white/90">
              Join an open group trip, or start one and let travelers request in.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-bold text-ink">
              Browse flocks <ArrowRight size={15} />
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
