import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil, MapPin, CalendarClock, MessageCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import FlockJoinRequests, { type JoinReq } from "@/components/FlockJoinRequests";
import DeleteTripButton from "@/components/DeleteTripButton";
import PageTabs from "@/components/PageTabs";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 5;

type TripRow = {
  id: string;
  kind: string;
  title: string | null;
  destination: string | null;
  destinations: string[] | null;
  start_date: string;
  end_date: string;
  group_size: number;
  trip_type: string[] | null;
  visibility: string;
  status: string;
  cover_photo: string | null;
};

export default async function MyTripsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const supabase = await createClient();
  const user = await getSessionUser();
  const tr = await getTranslations("trips");

  const TRIP_TABS = [
    { href: "/my-activities", label: tr("tabs.myActivities") },
    { href: "/deals", label: tr("tabs.deals") },
    { href: "/my-trips", label: tr("tabs.myTrips") },
  ];

  const { data: trips } = await supabase
    .from("trips")
    .select("id, kind, title, destination, destinations, start_date, end_date, group_size, trip_type, visibility, status, created_at, cover_photo")
    .eq("user_id", user!.id)
    .neq("kind", "activity") // activities live under the My Activities tab
    .order("created_at", { ascending: false });

  const all = (trips ?? []) as TripRow[];
  const todayStr = new Date().toISOString().slice(0, 10);
  const isPast = (t: TripRow) =>
    t.status === "completed" || t.status === "cancelled" || (!!t.end_date && t.end_date < todayStr);
  const activeTrips = all.filter((t) => !isPast(t));
  const pastTrips = all.filter(isPast);

  const page = Math.max(1, Number(searchParams.page) || 1);
  const totalPages = Math.max(1, Math.ceil(activeTrips.length / PAGE_SIZE));
  const pageTrips = activeTrips.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Join requests to my trips (host approval) — active trips only.
  const activeIds = activeTrips.map((t) => t.id);
  const coHostTrips = new Set<string>();
  const reqByTrip: Record<string, JoinReq[]> = {};
  // Buddy/Flock chat per trip — the chat hangs off a buddy_match for the trip.
  const allTripIds = all.map((t) => t.id);
  const chatByTrip: Record<string, string> = {};

  // Co-host flags, join requests, and trip matches all key on the trip lists.
  const inList = `(${allTripIds.join(",")})`;
  const [{ data: ch }, { data: jr }, { data: matches }] = await Promise.all([
    activeIds.length
      ? supabase.from("trips").select("id").in("id", activeIds).not("co_host_id", "is", null)
      : Promise.resolve({ data: null }),
    activeIds.length
      ? supabase
          .from("trip_join_requests")
          .select("trip_id, user_id, status")
          .in("trip_id", activeIds)
      : Promise.resolve({ data: null }),
    allTripIds.length
      ? supabase
          .from("buddy_matches")
          .select("id, trip_a, trip_b")
          .or(`trip_a.in.${inList},trip_b.in.${inList}`)
      : Promise.resolve({ data: null }),
  ]);

  ch?.forEach((r) => coHostTrips.add(r.id));
  const reqUserIds = Array.from(new Set((jr ?? []).map((r) => r.user_id)));
  const matchIds = (matches ?? []).map((m) => m.id);

  // Vibe-match between me (host) and each requester, so I can gauge fit —
  // kicked off alongside the profile + chat lookups below.
  const matchByUser: Record<string, number | null> = {};
  // One RPC for all requesters (was one round-trip per requester).
  const scoresPromise = reqUserIds.length
    ? supabase
        .rpc("buddy_pair_scores", { p_a: user!.id, p_b: reqUserIds })
        .then(({ data }) => {
          (data ?? []).forEach((r: { user_id: string; score: number | null }) => {
            matchByUser[r.user_id] = typeof r.score === "number" ? Math.round(r.score) : null;
          });
        })
    : Promise.resolve();
  const [{ data: rpData }, { data: chats }] = await Promise.all([
    reqUserIds.length
      ? supabase
          .from("public_profiles")
          .select("id, display_name, age, photos, one_liner")
          .in("id", reqUserIds)
      : Promise.resolve({ data: null }),
    matchIds.length
      ? supabase.from("buddy_chats").select("id, match_id").in("match_id", matchIds)
      : Promise.resolve({ data: null }),
  ]);
  await scoresPromise;

  const rp: Record<string, { display_name: string | null; age: number | null; photos: string[] | null; one_liner: string | null }> = {};
  rpData?.forEach((p) => (rp[p.id] = p));
  (jr ?? []).forEach((r) => {
    (reqByTrip[r.trip_id] ??= []).push({
      userId: r.user_id,
      status: r.status,
      name: rp[r.user_id]?.display_name || "Flockie",
      age: rp[r.user_id]?.age ?? null,
      photo: rp[r.user_id]?.photos?.[0] ?? null,
      oneLiner: rp[r.user_id]?.one_liner ?? null,
      match: matchByUser[r.user_id] ?? null,
    });
  });

  const chatByMatch: Record<string, string> = {};
  chats?.forEach((c) => (chatByMatch[c.match_id] = c.id));
  (matches ?? []).forEach((m) => {
    const cid = chatByMatch[m.id];
    if (!cid) return;
    if (m.trip_a && allTripIds.includes(m.trip_a)) chatByTrip[m.trip_a] = cid;
    if (m.trip_b && allTripIds.includes(m.trip_b)) chatByTrip[m.trip_b] = cid;
  });

  function TripCard({ t, faded }: { t: TripRow; faded?: boolean }) {
    return (
      <div
        id={`trip-${t.id}`}
        className={`scroll-mt-20 rounded-2xl border border-ink/15 bg-white p-4 shadow-[0_2px_10px_rgba(10,37,69,0.08)] ${faded ? "opacity-60" : ""}`}
      >
        {/* Stacked on mobile (info row, then actions); side-by-side from sm. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-3">
          {t.cover_photo && (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-ink/15 bg-cream">
              <Image src={t.cover_photo} alt="" fill sizes="64px" className="object-cover" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full border border-ink/15 px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                  t.visibility === "public" ? "bg-flockie-orange text-white" : "bg-navy text-white"
                }`}
              >
                {t.visibility === "public" ? tr("list.badgeFlock") : tr("list.badgeTrip")}
              </span>
              {faded ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                    t.status === "cancelled" ? "bg-ink text-white" : "bg-[#06D6A0] text-white"
                  }`}
                >
                  {t.status === "cancelled" ? tr("list.statusCancelled") : tr("list.statusCompleted")}
                </span>
              ) : (
                t.status !== "active" && (
                  <span className="text-[10px] font-bold uppercase text-muted">{t.status}</span>
                )
              )}
            </div>
            <p className="mt-1 flex items-center gap-1.5 font-extrabold">
              <MapPin size={15} className="text-flockie-orange" />{" "}
              {(t.destinations ?? [t.destination]).filter(Boolean).join(" · ")}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-muted">
              <CalendarClock size={13} /> {t.start_date} → {t.end_date} · {tr("list.people", { count: t.group_size })}
            </p>
            {(t.trip_type?.length ?? 0) > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {t.trip_type!.map((tag) => (
                  <span key={tag} className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-bold">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
            {!faded && (
              <Link
                href={chatByTrip[t.id] ? `/buddies/${chatByTrip[t.id]}` : "/chats?tab=travel"}
                className="flex shrink-0 items-center gap-1 rounded-full border border-ink/15 bg-flockie-blue px-3 py-1.5 text-sm font-bold text-white"
              >
                <MessageCircle size={14} /> {t.visibility === "public" ? tr("list.flockChat") : tr("list.chat")}
              </Link>
            )}
            {!faded && (
              <Link
                href={`/match/trip?id=${t.id}`}
                className="flex shrink-0 items-center gap-1 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-sm font-bold"
              >
                <Pencil size={14} /> {tr("list.edit")}
              </Link>
            )}
            <DeleteTripButton tripId={t.id} label={t.visibility === "public" ? tr("list.deleteFlock") : tr("list.deleteTrip")} />
          </div>
        </div>
        {!faded && reqByTrip[t.id]?.length ? (
          <FlockJoinRequests tripId={t.id} requests={reqByTrip[t.id]} dualApproval={coHostTrips.has(t.id)} canRemove />
        ) : null}
      </div>
    );
  }

  return (
    <main className="px-5 pb-10 pt-6">
      <PageTabs tabs={TRIP_TABS} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">{tr("list.heading")}</h1>
        <Link
          href="/match/trip"
          className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-flockie-orange px-4 py-2 text-sm font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
        >
          <Plus size={16} /> {tr("list.new")}
        </Link>
      </div>
      <p className="mt-1 text-sm font-medium text-muted">{tr("list.subtitle")}</p>

      <div className="mt-6 space-y-3">
        {activeTrips.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-ink/30 py-12 text-center font-medium text-muted">
            {tr("list.emptyActive")}
          </div>
        ) : (
          pageTrips.map((t) => <TripCard key={t.id} t={t} />)
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} hrefFor={(p) => (p > 1 ? `/my-trips?page=${p}` : "/my-trips")} />

      {pastTrips.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-extrabold text-muted">{tr("list.pastHeading")}</h2>
          <div className="mt-3 space-y-3">
            {pastTrips.map((t) => (
              <TripCard key={t.id} t={t} faded />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
