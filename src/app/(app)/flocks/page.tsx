import Link from "next/link";
import Image from "next/image";
import { MapPin, CalendarClock, Users, Plus, ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import FlockRequestButton from "@/components/FlockRequestButton";
import FilterSheet from "@/components/FilterSheet";
import Pagination from "@/components/Pagination";
import { loadFlockMatch } from "@/lib/vibe-stats";
import { tripDays, GROUP_SIZE_BUCKETS, CONTINENTS, FLOCK_LANGUAGES, GROUP_GENDERS } from "@/lib/trips";

const PAGE_SIZE = 6;

const toArray = (v?: string | string[]) => (Array.isArray(v) ? v : v ? [v] : []);

export default async function FlocksPage({
  searchParams,
}: {
  searchParams: { page?: string; continent?: string | string[]; gender?: string; size?: string; language?: string | string[] };
}) {
  const supabase = await createClient();
  const user = await getSessionUser();
  const tr = await getTranslations("flocks");
  const tc = await getTranslations("components");

  const FLOCK_FILTER_SECTIONS = [
    { key: "continent", title: tr("filters.continent"), multi: true, options: CONTINENTS.map((c) => ({ value: c, label: tc(`continents.${c}`) })) },
    { key: "gender", title: tr("filters.openTo"), options: GROUP_GENDERS.map((g) => ({ value: g.value, label: tc(`groupGenders.${g.value}`) })) },
    { key: "size", title: tr("filters.groupSize"), options: GROUP_SIZE_BUCKETS.map((b) => ({ value: b.value, label: tr("filters.sizePeople", { label: b.label }) })) },
    { key: "language", title: tr("filters.language"), multi: true, options: FLOCK_LANGUAGES.map((l) => ({ value: l, label: tc(`languages.${l}`) })) },
  ];

  const page = Math.max(1, Number(searchParams.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const continents = toArray(searchParams.continent);
  const languages = toArray(searchParams.language);
  const gender = typeof searchParams.gender === "string" ? searchParams.gender : "";
  const sizeBucket = GROUP_SIZE_BUCKETS.find((b) => b.value === searchParams.size);

  let query = supabase
    .from("trips")
    .select(
      "id, user_id, destination, destinations, start_date, end_date, group_size, trip_type, cover_photo, continent, group_gender, language, budget, description",
      { count: "exact" }
    )
    .eq("visibility", "public")
    .eq("kind", "trip")
    .eq("status", "active")
    .neq("user_id", user!.id)
    .gte("end_date", new Date().toISOString().slice(0, 10));

  if (continents.length) query = query.in("continent", continents);
  if (gender) query = query.eq("group_gender", gender);
  if (languages.length) query = query.in("language", languages);
  if (sizeBucket) query = query.gte("group_size", sizeBucket.min).lte("group_size", sizeBucket.max);

  // The trip-prefs gate and the flock feed both key on the viewer only.
  // Prefs stay guarded (migration-safe): if the column doesn't exist yet,
  // degrade open so we don't block.
  const [{ data: prefRow, error: prefErr }, { data: trips, count }] = await Promise.all([
    supabase.from("profiles").select("trip_prefs_complete").eq("id", user!.id).maybeSingle(),
    query.order("start_date", { ascending: true }).range(from, from + PAGE_SIZE - 1),
  ]);
  const tripPrefsDone = prefErr ? true : !!prefRow?.trip_prefs_complete;

  const list = trips ?? [];
  const ids = list.map((t) => t.id);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const hrefFor = (p: number) => {
    const sp = new URLSearchParams();
    continents.forEach((c) => sp.append("continent", c));
    if (gender) sp.set("gender", gender);
    if (searchParams.size) sp.set("size", searchParams.size);
    languages.forEach((l) => sp.append("language", l));
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `/flocks?${qs}` : "/flocks";
  };

  // join requests: accepted count via definer RPC (no row-level exposure),
  // "requested" from my own LIVE rows (visible under the scoped RLS policy).
  // Declined rows don't count — the button comes back so the user can re-request.
  // These four reads all key on the page's trip/host id lists — one stage.
  const acceptedCount: Record<string, number> = {};
  const requested = new Set<string>();
  const hostIds = Array.from(new Set(list.map((t) => t.user_id)));
  const profiles: Record<string, { display_name: string | null; photos: string[] | null }> = {};
  const [{ data: counts }, { data: mine }, { data: pp }, matches] = await Promise.all([
    ids.length
      ? supabase.rpc("flock_going_counts", { p_trip_ids: ids })
      : Promise.resolve({ data: null }),
    ids.length
      ? supabase
          .from("trip_join_requests")
          .select("trip_id")
          .eq("user_id", user!.id)
          .in("trip_id", ids)
          .in("status", ["pending", "accepted"])
      : Promise.resolve({ data: null }),
    hostIds.length
      ? supabase.from("public_profiles").select("id, display_name, photos").in("id", hostIds)
      : Promise.resolve({ data: null }),
    loadFlockMatch(supabase, ids),
  ]);
  (counts ?? []).forEach((c: { trip_id: string; accepted: number }) => {
    acceptedCount[c.trip_id] = c.accepted;
  });
  (mine ?? []).forEach((r) => requested.add(r.trip_id));
  pp?.forEach((p) => (profiles[p.id] = { display_name: p.display_name, photos: p.photos }));

  // Full Flocks drop off the list.
  const cards = list.filter((t) => 1 + (acceptedCount[t.id] ?? 0) < t.group_size);

  return (
    <main className="px-5 pb-10 pt-6">
      <Link
        href="/trips"
        className="mb-2 inline-flex items-center gap-1 text-sm font-bold text-ink/55 hover:text-ink"
      >
        <ArrowLeft size={15} /> {tr("browse.backToTrips")}
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">{tr("browse.heading")}</h1>
        <Link
          href="/match/trip?kind=flock"
          className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-flockie-orange px-4 py-2 text-sm font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
        >
          <Plus size={16} /> {tr("browse.create")}
        </Link>
      </div>
      <p className="mt-1 text-sm font-medium text-muted">
        {tr.rich("browse.subtitle", { b: (chunks) => <span className="font-bold">{chunks}</span> })}
      </p>

      <div className="mt-4">
        <FilterSheet basePath="/flocks" sections={FLOCK_FILTER_SECTIONS} />
      </div>

      {cards.length === 0 ? (
        <div className="mt-6 rounded-3xl border-2 border-dashed border-ink/30 py-16 text-center font-medium text-muted">
          {continents.length || gender || languages.length || sizeBucket
            ? tr("browse.emptyFiltered")
            : tr("browse.emptyNone")}
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-3 gap-2.5">
            {cards.map((t) => {
              const days = tripDays(t.start_date, t.end_date);
              const pct = matches[t.id];
              const going = 1 + (acceptedCount[t.id] ?? 0);
              const host = profiles[t.user_id];
              const hostName = host?.display_name || tr("browse.hostFallback");
              const destination = (t.destinations ?? [t.destination]).filter(Boolean).join(" · ");
              return (
                <div
                  key={t.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-ink/15 bg-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
                >
                  {/* Artwork — square so the whole cover shows, never cropped */}
                  <Link href={`/flocks/${t.id}`} className="relative block aspect-square w-full border-b border-ink/12 bg-cream">
                    {t.cover_photo ? (
                      <Image
                        src={t.cover_photo}
                        alt=""
                        fill
                        sizes="(max-width:640px) 33vw, 240px"
                        className="object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl">🧳</div>
                    )}
                    {typeof pct === "number" && (
                      <span className="absolute right-1.5 top-1.5 rounded-full border border-ink/15 bg-flockie-blue px-1.5 py-0.5 text-[9px] font-extrabold leading-none text-white">
                        ✨ {pct}%
                      </span>
                    )}
                  </Link>

                  {/* Body */}
                  <div className="flex flex-1 flex-col p-2.5">
                    <Link
                      href={`/flocks/${t.id}`}
                      className="line-clamp-2 flex items-start gap-1 text-[13px] font-extrabold leading-tight text-ink"
                    >
                      <MapPin size={12} className="mt-0.5 shrink-0 text-flockie-orange" />
                      <span className="line-clamp-2">{destination}</span>
                    </Link>
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-medium leading-tight text-muted">
                      <CalendarClock size={11} className="shrink-0" />
                      <span className="truncate">
                        {t.start_date} → {t.end_date}
                        {days > 0 && ` · ${tr("browse.daysShort", { count: days })}`}
                      </span>
                    </p>

                    {/* Quick facts to help decide before requesting */}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {t.group_gender === "women" && (
                        <span className="rounded-full bg-flockie-coral/15 px-1.5 py-0.5 text-[9px] font-bold text-flockie-coral">
                          {tr("browse.womenOnly")}
                        </span>
                      )}
                      {t.language && (
                        <span className="rounded-full bg-cream px-1.5 py-0.5 text-[9px] font-bold text-ink/70">
                          🗣 {t.language}
                        </span>
                      )}
                      {typeof t.budget === "number" && (
                        <span className="rounded-full bg-cream px-1.5 py-0.5 text-[9px] font-bold text-ink/70">
                          {t.budget <= 2 ? tr("budget.friendly") : t.budget === 3 ? tr("budget.mid") : tr("budget.comfort")}
                        </span>
                      )}
                      {t.trip_type?.[0] && (
                        <span className="rounded-full bg-cream px-1.5 py-0.5 text-[9px] font-bold text-ink/70">
                          {t.trip_type[0]}
                        </span>
                      )}
                    </div>

                    {t.description && (
                      <p className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-snug text-muted">
                        {t.description}
                      </p>
                    )}

                    <div className="mt-auto pt-2">
                      <div className="flex items-center justify-between gap-1 pt-0.5">
                        <span className="flex min-w-0 items-center gap-1 text-[11px] font-medium text-ink">
                          {host?.photos?.[0] ? (
                            <Image
                              src={host.photos[0]}
                              alt=""
                              width={18}
                              height={18}
                              className="h-[18px] w-[18px] shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-flockie-blue text-[9px] font-bold text-white">
                              {hostName[0]}
                            </span>
                          )}
                          <span className="truncate">{hostName}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-muted">
                          <Users size={11} /> {going}/{t.group_size}
                        </span>
                      </div>

                      <div className="mt-2.5">
                        <FlockRequestButton tripId={t.id} requested={requested.has(t.id)} tripPrefsDone={tripPrefsDone} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} hrefFor={hrefFor} />
        </>
      )}
    </main>
  );
}
