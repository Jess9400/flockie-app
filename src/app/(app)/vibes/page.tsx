import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import VibeCard, { type VibeCardData } from "@/components/VibeCard";
import VibeSearch from "@/components/VibeSearch";
import LocationPrompt from "@/components/LocationPrompt";
import Pagination from "@/components/Pagination";
import VibeInlineFilters from "@/components/VibeInlineFilters";
import { loadVibeMatch, type VibeDisplayMatch } from "@/lib/vibe-stats";
import { VIBE_CATEGORIES, type InterestStatus } from "@/lib/vibes";

const PAGE_SIZE = 6;

export default async function VibesPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    city?: string;
    page?: string;
    when?: string;
    view?: string;
    category?: string | string[];
  };
}) {
  const supabase = await createClient();
  const t = await getTranslations("vibes");
  const q = searchParams.q?.trim() ?? "";
  const city = searchParams.city?.trim() ?? "";
  const when =
    searchParams.when === "today" || searchParams.when === "48" || searchParams.when === "weekend"
      ? searchParams.when
      : "all";
  const categories = (
    Array.isArray(searchParams.category)
      ? searchParams.category
      : searchParams.category
        ? [searchParams.category]
        : []
  ).filter((c) => VIBE_CATEGORIES.includes(c as (typeof VIBE_CATEGORIES)[number]));
  const view = searchParams.view === "past" ? "past" : "upcoming";
  const isPast = view === "past";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const user = await getSessionUser();

  const [{ data: profile }, { data: loc }, { data: hiddenRows }] = await Promise.all([
    supabase.from("profiles").select("activities, home_city").eq("id", user!.id).single(),
    supabase.from("profiles").select("location_tracking_enabled").eq("id", user!.id).maybeSingle(),
    supabase.from("vibe_feedback").select("vibe_id").eq("user_id", user!.id).eq("signal", "not_for_me"),
  ]);

  const activityCheckDone = (profile?.activities ?? []).length > 0;
  const trackingEnabled = !!loc?.location_tracking_enabled;
  const hiddenVibeIds = Array.from(new Set((hiddenRows ?? []).map((r) => r.vibe_id)));

  const nowIso = new Date().toISOString();
  let query = supabase
    .from("vibe_directory")
    .select(
      "id, host_id, title, category, categories, photos, city, area, country, starts_at, timezone, capacity, event_vibe_tags",
      { count: "exact" }
    );

  if (isPast) {
    // Past: events that have started, within the last 45 days, that weren't cancelled.
    const cutoff = new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString();
    query = query.lt("starts_at", nowIso).gte("starts_at", cutoff).neq("status", "cancelled");
  } else {
    query = query.gte("starts_at", nowIso).in("status", ["open", "reviewing", "ranking", "finalized"]);
  }

  if (city) query = query.ilike("city", `%${city}%`);
  // Single search field matches vibe title, category, or city.
  if (q) query = query.or(`title.ilike.%${q}%,category.ilike.%${q}%,city.ilike.%${q}%`);
  // Category filter (multi): match the primary category OR the multi-select array.
  if (categories.length) {
    query = query.or(
      categories.flatMap((c) => [`category.eq.${c}`, `categories.cs.{${c}}`]).join(",")
    );
  }
  if (!isPast && hiddenVibeIds.length) query = query.not("id", "in", `(${hiddenVibeIds.join(",")})`);

  // Time window (upcoming only): Today / Next 48h / This weekend / Anytime.
  if (!isPast && when === "today") {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    query = query.lte("starts_at", endOfToday.toISOString());
  } else if (!isPast && when === "48") {
    query = query.lte("starts_at", new Date(Date.now() + 48 * 3600 * 1000).toISOString());
  } else if (!isPast && when === "weekend") {
    // Upcoming Sat 00:00 → Sun 23:59 (this weekend if it's still ahead).
    const now = new Date();
    const satStart = new Date(now);
    satStart.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7));
    satStart.setHours(0, 0, 0, 0);
    const sunEnd = new Date(satStart);
    sunEnd.setDate(satStart.getDate() + 1);
    sunEnd.setHours(23, 59, 59, 999);
    query = query.gte("starts_at", satStart.toISOString()).lte("starts_at", sunEnd.toISOString());
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

  const [
    { data: hostProfiles },
    vibeMatch,
    { data: reviewRows },
    { data: confirmed },
    { data: myInterests },
  ] = await Promise.all([
    hostIds.length
      ? supabase.from("public_profiles").select("id, display_name, photos").in("id", hostIds)
      : Promise.resolve({ data: [] }),
    isPast ? Promise.resolve({} as Record<string, VibeDisplayMatch>) : loadVibeMatch(supabase, ids),
    isPast && ids.length
      ? supabase.from("vibe_reviews").select("vibe_id, rating").in("vibe_id", ids)
      : Promise.resolve({ data: [] }),
    // "Going" counts via aggregate RPC (vibe_interests is no longer broadly
    // readable; see supabase/vibe-attendees-rls.sql)
    ids.length
      ? supabase.rpc("vibe_confirmed_counts", { p_vibes: ids })
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("vibe_interests").select("vibe_id, status").eq("user_id", user!.id).in("vibe_id", ids)
      : Promise.resolve({ data: [] }),
  ]);

  hostProfiles?.forEach((h) => {
    hosts[h.id] = { display_name: h.display_name, photos: h.photos };
  });

  const ratings: Record<string, number> = {};
  const agg: Record<string, { sum: number; n: number }> = {};
  reviewRows?.forEach((r) => {
    if (r.rating != null) {
      (agg[r.vibe_id] ??= { sum: 0, n: 0 });
      agg[r.vibe_id].sum += r.rating as number;
      agg[r.vibe_id].n += 1;
    }
  });
  Object.entries(agg).forEach(([id, a]) => (ratings[id] = a.sum / a.n));

  (confirmed as { vibe_id: string; going: number }[] | null)?.forEach((r) => {
    counts[r.vibe_id] = r.going;
  });
  myInterests?.forEach((r) => {
    mine[r.vibe_id] = r.status as InterestStatus;
  });

  return (
    <main className="px-5 pt-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-black">{t("list.heading")}</h1>
        <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/my-vibes"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-bold text-ink"
        >
          {t("list.tabMyVibes")}
        </Link>
        <Link
          href="/vibes/new"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/15 bg-flockie-orange px-4 py-2 text-sm font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
        >
          <Plus size={16} /> {t("list.create")}
        </Link>
        </div>
      </div>
      <p className="mt-3 max-w-xl text-sm font-medium text-muted">
        {t.rich("list.intro", { b: (chunks) => <span className="font-bold">{chunks}</span> })}
      </p>
      {/* One search bar — matches vibes, categories and cities — with the
          filter controls tucked inside it. */}
      <VibeSearch q={q}>
        {!isPast && (
          <VibeInlineFilters
            whenOptions={[
              { value: "", label: t("list.whenAnytime") },
              { value: "today", label: t("list.whenToday") },
              { value: "48", label: t("list.when48") },
              { value: "weekend", label: t("list.whenWeekend") },
            ]}
            categoryOptions={VIBE_CATEGORIES.filter((c) => c !== "other").map((c) => ({
              value: c,
              label: t(`categories.${c}`),
            }))}
            labels={{ anyTime: t("list.whenAnytime"), category: t("list.filterCategory") }}
          />
        )}
      </VibeSearch>

      {/* Upcoming / Past — below the bar. */}
      <div className="mt-4 inline-flex shrink-0 gap-1 rounded-full border border-ink/15 p-1 text-sm font-bold">
        <Link
          href="/vibes"
          className={`rounded-full px-4 py-1.5 ${!isPast ? "bg-flockie-coral text-white" : "text-ink/55 hover:text-ink"}`}
        >
          {t("list.upcoming")}
        </Link>
        <Link
          href="/vibes?view=past"
          className={`rounded-full px-4 py-1.5 ${isPast ? "bg-flockie-coral text-white" : "text-ink/55 hover:text-ink"}`}
        >
          {t("list.past")}
        </Link>
      </div>

      {!isPast && !activityCheckDone && (
        <Link
          href="/onboarding/vibe-check?returnTo=%2Fvibes"
          className="mt-4 block rounded-2xl border border-ink/15 bg-flockie-blue p-3 text-sm font-bold text-white"
        >
          {t("list.completeCheck")}
        </Link>
      )}

      {list.length === 0 ? (
        <div className="mt-6 rounded-3xl border-2 border-dashed border-ink/30 py-16 text-center font-medium text-muted">
          {isPast
            ? t("list.emptyPast")
            : q || city
              ? t("list.emptySearch")
              : t("list.emptyNone")}
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {list.map((v) => (
              <VibeCard
                key={v.id}
                vibe={{ ...v, host: hosts[v.host_id] ?? null } as VibeCardData}
                confirmedCount={counts[v.id] ?? 0}
                myStatus={isPast ? null : mine[v.id] ?? null}
                match={isPast || v.host_id === user!.id ? undefined : vibeMatch[v.id]}
                faded={isPast}
                rating={isPast ? ratings[v.id] ?? null : undefined}
                canDismiss={!isPast && v.host_id !== user!.id && !mine[v.id]}
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
