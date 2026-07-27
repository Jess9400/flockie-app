import Link from "next/link";
import Image from "next/image";
import { MapPin, CalendarClock, Users, Plus, ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import TripJoinButton from "@/components/TripJoinButton";
import FilterSheet from "@/components/FilterSheet";
import SearchBar from "@/components/SearchBar";
import Pagination from "@/components/Pagination";
import { tripDays, GROUP_SIZE_BUCKETS, CONTINENTS, FLOCK_LANGUAGES, GROUP_GENDERS } from "@/lib/trips";

const PAGE_SIZE = 9;

const toArray = (v?: string | string[]) => (Array.isArray(v) ? v : v ? [v] : []);

type BoardRow = {
  trip_id: string;
  kind: "trip" | "flock";
  destination: string | null;
  destinations: string[] | null;
  start_date: string;
  end_date: string;
  group_size: number;
  trip_type: string[] | null;
  budget: number | null;
  description: string | null;
  cover_photo: string | null;
  continent: string | null;
  group_gender: string | null;
  language: string | null;
  creator_id: string;
  creator_name: string | null;
  creator_age: number | null;
  creator_photo: string | null;
  trips_taken: number;
  countries_visited: number | null;
  languages_spoken: string[] | null;
  going: number;
  score: number | null;
  my_request_status: string | null;
};

// The Trip Board: solo trips (1:1) and Flocks (group) in one browsable list -
// trip-first cards, the creator as context, "Ask to join" with a note.
export default async function TripBoardPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string; continent?: string | string[]; gender?: string; size?: string; language?: string | string[]; kind?: string };
}) {
  const supabase = await createClient();
  const user = await getSessionUser();
  void user;
  const tr = await getTranslations("flocks");
  const tb = await getTranslations("trips.board");
  const tc = await getTranslations("components");

  const FILTER_SECTIONS = [
    {
      key: "kind",
      title: tb("filterKind"),
      options: [
        { value: "trip", label: tb("kindTrip") },
        { value: "flock", label: tb("kindFlock") },
      ],
    },
    { key: "continent", title: tr("filters.continent"), multi: true, options: CONTINENTS.map((c) => ({ value: c, label: tc(`continents.${c}`) })) },
    { key: "gender", title: tr("filters.openTo"), options: GROUP_GENDERS.map((g) => ({ value: g.value, label: tc(`groupGenders.${g.value}`) })) },
    { key: "size", title: tr("filters.groupSize"), options: GROUP_SIZE_BUCKETS.map((b) => ({ value: b.value, label: tr("filters.sizePeople", { label: b.label }) })) },
    { key: "language", title: tr("filters.language"), multi: true, options: FLOCK_LANGUAGES.map((l) => ({ value: l, label: tc(`languages.${l}`) })) },
  ];

  const page = Math.max(1, Number(searchParams.page) || 1);
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const continents = toArray(searchParams.continent);
  const languages = toArray(searchParams.language);
  const gender = typeof searchParams.gender === "string" ? searchParams.gender : "";
  const kindFilter = searchParams.kind === "trip" || searchParams.kind === "flock" ? searchParams.kind : "";
  const sizeBucket = GROUP_SIZE_BUCKETS.find((b) => b.value === searchParams.size);

  // One definer RPC covers both kinds (private 1:1 trips aren't readable via
  // RLS). Migration-safe: before trip-board.sql runs, render empty.
  const { data: boardRaw, error: boardErr } = await supabase.rpc("trip_board", { p_limit: 120 });
  const all: BoardRow[] = boardErr ? [] : ((boardRaw ?? []) as BoardRow[]);

  // Lists are small pre-scale - filter in TS so the existing filter UI keeps
  // working without a parameter-heavy RPC.
  const filtered = all.filter((t) => {
    if (kindFilter && t.kind !== kindFilter) return false;
    if (continents.length && !continents.includes(t.continent ?? "")) return false;
    if (gender && (t.group_gender ?? "any") !== gender) return false;
    if (languages.length && !languages.includes(t.language ?? "")) return false;
    if (sizeBucket && (t.group_size < sizeBucket.min || t.group_size > sizeBucket.max)) return false;
    if (q) {
      const hay = [t.destination, ...(t.destinations ?? []), t.description, t.creator_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cards = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hrefFor = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", searchParams.q ?? "");
    if (kindFilter) sp.set("kind", kindFilter);
    continents.forEach((c) => sp.append("continent", c));
    if (gender) sp.set("gender", gender);
    if (searchParams.size) sp.set("size", searchParams.size);
    languages.forEach((l) => sp.append("language", l));
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `/flocks?${qs}` : "/flocks";
  };

  return (
    <main className="px-5 pb-10 pt-6">
      <Link
        href="/trips"
        className="mb-2 inline-flex items-center gap-1 text-sm font-bold text-ink/55 hover:text-ink"
      >
        <ArrowLeft size={15} /> {tr("browse.backToTrips")}
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">{tb("heading")}</h1>
        <Link
          href="/match/trip?kind=flock"
          className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-flockie-orange px-3 py-1.5 text-xs font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] sm:px-4 sm:py-2 sm:text-sm"
        >
          <Plus size={15} /> {tr("browse.create")}
        </Link>
      </div>
      <p className="mt-1 text-sm font-medium text-muted">{tb("subtitle")}</p>

      <div className="mt-4">
        <SearchBar basePath="/flocks" q={searchParams.q ?? ""} placeholder={tb("searchPlaceholder")}>
          <FilterSheet basePath="/flocks" sections={FILTER_SECTIONS} preserveKeys={["q"]} />
        </SearchBar>
      </div>

      {cards.length === 0 ? (
        <div className="mt-6 rounded-3xl border-2 border-dashed border-ink/30 py-16 text-center font-medium text-muted">
          {q || kindFilter || continents.length || gender || languages.length || sizeBucket
            ? tr("browse.emptyFiltered")
            : tb("emptyNone")}
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((t) => {
              const days = tripDays(t.start_date, t.end_date);
              const destination = (t.destinations ?? [t.destination]).filter(Boolean).join(" · ");
              const creatorName = t.creator_name || tr("browse.hostFallback");
              const href = t.kind === "flock" ? `/flocks/${t.trip_id}` : `/trips/${t.trip_id}`;
              return (
                <div
                  key={t.trip_id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-ink/15 bg-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
                >
                  <Link href={href} className="relative block aspect-[16/9] w-full border-b border-ink/12 bg-cream">
                    {t.cover_photo ? (
                      <Image src={t.cover_photo} alt="" fill sizes="(max-width:640px) 100vw, 360px" className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl">
                        {t.kind === "flock" ? "🐦" : "🧳"}
                      </div>
                    )}
                    <span
                      className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase leading-none text-white shadow-[0_1px_5px_rgba(10,37,69,0.2)] ${
                        t.kind === "flock" ? "bg-flockie-orange" : "bg-flockie-blue"
                      }`}
                    >
                      {t.kind === "flock" ? tb("kindFlock") : tb("kindTrip")}
                    </span>
                    {t.score != null && t.score > 0 && (
                      <span className="absolute right-2 top-2 rounded-full border border-ink/15 bg-flockie-blue px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-white">
                        ✨ {Math.round(t.score)}%
                      </span>
                    )}
                  </Link>

                  <div className="flex flex-1 flex-col p-3">
                    <p className="flex items-start gap-1 text-sm font-extrabold leading-tight text-ink">
                      <MapPin size={13} className="mt-0.5 shrink-0 text-flockie-orange" />
                      <span className="line-clamp-2">{destination}</span>
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-medium leading-tight text-muted">
                      <CalendarClock size={11} className="shrink-0" />
                      <span className="truncate">
                        {t.start_date} → {t.end_date}
                        {days > 0 && ` · ${tr("browse.daysShort", { count: days })}`}
                      </span>
                    </p>

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
                      {(t.trip_type ?? []).slice(0, 2).map((tag) => (
                        <span key={tag} className="rounded-full bg-cream px-1.5 py-0.5 text-[9px] font-bold text-ink/70">
                          {tag}
                        </span>
                      ))}
                    </div>

                    {t.description && (
                      <p className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-snug text-muted">
                        {t.description}
                      </p>
                    )}

                    <div className="mt-auto pt-2">
                      <Link href={`/people/${t.creator_id}`} className="flex items-center gap-1.5">
                        {t.creator_photo ? (
                          <Image src={t.creator_photo} alt="" width={20} height={20} className="h-5 w-5 shrink-0 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-flockie-blue text-[9px] font-bold text-white">
                            {creatorName[0]?.toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0 truncate text-[11px] font-bold text-ink/70">
                          {creatorName}
                          {t.creator_age ? `, ${t.creator_age}` : ""}
                        </span>
                        {t.countries_visited && t.countries_visited > 0 ? (
                          <span className="shrink-0 rounded-full bg-cream px-1.5 py-0.5 text-[9px] font-bold text-ink/60">
                            🌍 {tb("countriesVisited", { count: t.countries_visited })}
                          </span>
                        ) : t.trips_taken > 0 ? (
                          <span className="shrink-0 rounded-full bg-cream px-1.5 py-0.5 text-[9px] font-bold text-ink/60">
                            🌍 {tb("tripsTaken", { count: t.trips_taken })}
                          </span>
                        ) : null}
                        {(t.languages_spoken ?? []).length > 0 && (
                          <span className="shrink-0 rounded-full bg-cream px-1.5 py-0.5 text-[9px] font-bold text-ink/60">
                            🗣 {(t.languages_spoken ?? []).slice(0, 2).join(", ")}
                          </span>
                        )}
                        {t.kind === "flock" && (
                          <span className="ml-auto flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-muted">
                            <Users size={11} /> {t.going}/{t.group_size}
                          </span>
                        )}
                      </Link>
                      <div className="mt-2">
                        <TripJoinButton
                          tripId={t.trip_id}
                          destination={destination}
                          creatorName={creatorName}
                          initialStatus={t.my_request_status}
                        />
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
