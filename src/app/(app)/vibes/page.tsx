import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import VibeCard, { type VibeCardData } from "@/components/VibeCard";
import VibeSearch from "@/components/VibeSearch";
import LocationPrompt from "@/components/LocationPrompt";
import PageTabs from "@/components/PageTabs";
import Pagination from "@/components/Pagination";
import FilterSheet from "@/components/FilterSheet";
import { loadVibeMatch } from "@/lib/vibe-stats";

const PAGE_SIZE = 6;

const VIBE_TABS = [
  { href: "/vibes", label: "Vibes" },
  { href: "/my-vibes", label: "My Vibes" },
];
import type { InterestStatus } from "@/lib/vibes";

export default async function VibesPage({
  searchParams,
}: {
  searchParams: { q?: string; city?: string; page?: string; when?: string; view?: string };
}) {
  const supabase = await createClient();
  const q = searchParams.q?.trim() ?? "";
  const city = searchParams.city?.trim() ?? "";
  const when = searchParams.when === "today" || searchParams.when === "48" ? searchParams.when : "all";
  const view = searchParams.view === "past" ? "past" : "upcoming";
  const isPast = view === "past";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("activities, home_city")
    .eq("id", user!.id)
    .single();

  const activityCheckDone = (profile?.activities ?? []).length > 0;

  // Location tracking preference (separate, migration-safe query).
  const { data: loc } = await supabase
    .from("profiles")
    .select("location_tracking_enabled")
    .eq("id", user!.id)
    .maybeSingle();
  const trackingEnabled = !!loc?.location_tracking_enabled;

  const nowIso = new Date().toISOString();
  let query = supabase
    .from("vibes")
    .select(
      "id, host_id, title, category, photos, city, location_name, starts_at, capacity, event_vibe_tags",
      { count: "exact" }
    );

  if (isPast) {
    // Past: events that have started, within the last 45 days, that weren't cancelled.
    const cutoff = new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString();
    query = query.lt("starts_at", nowIso).gte("starts_at", cutoff).neq("status", "cancelled");
  } else {
    query = query.gte("starts_at", nowIso).in("status", ["open", "ranking", "finalized"]);
  }

  if (city) query = query.ilike("city", `%${city}%`);
  if (q) query = query.or(`title.ilike.%${q}%,category.ilike.%${q}%`);

  // Time window (upcoming only): Today / Next 48h / Anytime.
  if (!isPast && when === "today") {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    query = query.lte("starts_at", endOfToday.toISOString());
  } else if (!isPast && when === "48") {
    query = query.lte("starts_at", new Date(Date.now() + 48 * 3600 * 1000).toISOString());
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data: vibes, count } = await query
    .order("starts_at", { ascending: !isPast })
    .range(from, from + PAGE_SIZE - 1);

  const list = vibes ?? [];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const hrefFor = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (city) sp.set("city", city);
    if (isPast) sp.set("view", "past");
    if (!isPast && when !== "all") sp.set("when", when);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `/vibes?${qs}` : "/vibes";
  };
  const ids = list.map((v) => v.id);
  const hostIds = Array.from(new Set(list.map((v) => v.host_id)));

  // hosts, confirmed counts, my statuses — separate queries (no fragile embeds)
  const hosts: Record<string, { display_name: string | null; photos: string[] | null }> = {};
  const counts: Record<string, number> = {};
  const mine: Record<string, InterestStatus> = {};

  if (hostIds.length) {
    const { data: hp } = await supabase
      .from("profiles")
      .select("id, display_name, photos")
      .in("id", hostIds);
    hp?.forEach((h) => {
      hosts[h.id] = { display_name: h.display_name, photos: h.photos };
    });
  }

  const vibeMatch = isPast ? {} : await loadVibeMatch(supabase, ids);

  // Average ⭐ rating per past vibe (for the recap cards).
  const ratings: Record<string, number> = {};
  if (isPast && ids.length) {
    const { data: rv } = await supabase
      .from("vibe_reviews")
      .select("vibe_id, rating")
      .in("vibe_id", ids);
    const agg: Record<string, { sum: number; n: number }> = {};
    rv?.forEach((r) => {
      if (r.rating != null) {
        (agg[r.vibe_id] ??= { sum: 0, n: 0 });
        agg[r.vibe_id].sum += r.rating as number;
        agg[r.vibe_id].n += 1;
      }
    });
    Object.entries(agg).forEach(([id, a]) => (ratings[id] = a.sum / a.n));
  }

  if (ids.length) {
    const { data: confirmed } = await supabase
      .from("vibe_interests")
      .select("vibe_id")
      .eq("status", "confirmed")
      .in("vibe_id", ids);
    confirmed?.forEach((r) => {
      counts[r.vibe_id] = (counts[r.vibe_id] ?? 0) + 1;
    });

    const { data: myInterests } = await supabase
      .from("vibe_interests")
      .select("vibe_id, status")
      .eq("user_id", user!.id)
      .in("vibe_id", ids);
    myInterests?.forEach((r) => {
      mine[r.vibe_id] = r.status as InterestStatus;
    });
  }

  return (
    <main className="px-5 pt-6">
      <PageTabs tabs={VIBE_TABS} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Vibes</h1>
        <Link
          href="/vibes/new"
          className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-flockie-orange px-4 py-2 text-sm font-bold text-white shadow-[0_3px_0_0_#E0512C]"
        >
          <Plus size={16} /> Create
        </Link>
      </div>
      <p className="mt-1 text-sm font-medium text-muted">
        Curated <span className="font-bold">group</span> activities &amp; events —
        no swiping. Tap &ldquo;I&rsquo;m interested&rdquo; and the host&rsquo;s
        algorithm builds the room from the most compatible people, up to capacity.
        (Want 1:1? Find a Buddy.)
      </p>

      <div className="mt-4 inline-flex gap-1 rounded-full border-2 border-ink bg-white p-1 text-sm font-bold">
        <Link
          href="/vibes"
          className={`rounded-full px-4 py-1.5 ${!isPast ? "bg-ink text-white" : "text-ink hover:bg-navy/5"}`}
        >
          Upcoming
        </Link>
        <Link
          href="/vibes?view=past"
          className={`rounded-full px-4 py-1.5 ${isPast ? "bg-ink text-white" : "text-ink hover:bg-navy/5"}`}
        >
          Past
        </Link>
      </div>

      <VibeSearch q={q} city={city} />

      {!isPast && (
        <div className="mt-3">
          <FilterSheet
            basePath="/vibes"
            preserveKeys={["q", "city"]}
            sections={[
              {
                key: "when",
                title: "When",
                options: [
                  { value: "", label: "Anytime" },
                  { value: "today", label: "Today" },
                  { value: "48", label: "Next 48h" },
                ],
              },
            ]}
          />
        </div>
      )}

      {!isPast && !activityCheckDone && (
        <Link
          href="/profile"
          className="mt-4 block rounded-2xl border-2 border-ink bg-flockie-blue p-3 text-sm font-bold text-white"
        >
          Complete your activity vibe check to unlock smart matching →
        </Link>
      )}

      {list.length === 0 ? (
        <div className="mt-6 rounded-3xl border-2 border-dashed border-ink/30 py-16 text-center font-medium text-muted">
          {isPast
            ? "No past Vibes in the last 45 days yet."
            : q || city
              ? "No Vibes match your search. Try a different activity or city."
              : "No Vibes yet. Be the first to create one."}
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-3 gap-2.5">
            {list.map((v) => (
              <VibeCard
                key={v.id}
                vibe={{ ...v, host: hosts[v.host_id] ?? null } as VibeCardData}
                confirmedCount={counts[v.id] ?? 0}
                myStatus={isPast ? null : mine[v.id] ?? null}
                matchPct={isPast ? undefined : vibeMatch[v.id]}
                faded={isPast}
                rating={isPast ? ratings[v.id] ?? null : undefined}
              />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} hrefFor={hrefFor} />
        </>
      )}

      <LocationPrompt trackingEnabled={trackingEnabled} />
    </main>
  );
}
