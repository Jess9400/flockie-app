import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil, MapPin, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import FlockJoinRequests, { type JoinReq } from "@/components/FlockJoinRequests";
import DeleteTripButton from "@/components/DeleteTripButton";
import PageTabs from "@/components/PageTabs";
import Pagination from "@/components/Pagination";

const TRIP_TABS = [
  { href: "/my-trips", label: "My Trips" },
  { href: "/my-activities", label: "My Activities" },
  { href: "/deals", label: "Deals" },
];

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
  if (activeIds.length) {
    const { data: ch } = await supabase
      .from("trips")
      .select("id")
      .in("id", activeIds)
      .not("co_host_id", "is", null);
    ch?.forEach((r) => coHostTrips.add(r.id));

    const { data: jr } = await supabase
      .from("trip_join_requests")
      .select("trip_id, user_id, status")
      .in("trip_id", activeIds);
    const reqUserIds = Array.from(new Set((jr ?? []).map((r) => r.user_id)));
    const rp: Record<string, { display_name: string | null; age: number | null; photos: string[] | null; one_liner: string | null }> = {};
    if (reqUserIds.length) {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, age, photos, one_liner")
        .in("id", reqUserIds);
      data?.forEach((p) => (rp[p.id] = p));
    }
    // Vibe-match between me (host) and each requester, so I can gauge fit.
    const matchByUser: Record<string, number | null> = {};
    await Promise.all(
      reqUserIds.map(async (uid) => {
        const { data } = await supabase.rpc("buddy_pair_score", { p_a: user!.id, p_b: uid });
        matchByUser[uid] = typeof data === "number" ? Math.round(data) : null;
      })
    );
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
  }

  function TripCard({ t, faded }: { t: TripRow; faded?: boolean }) {
    return (
      <div
        className={`rounded-2xl border-2 border-ink bg-white p-4 shadow-[0_3px_0_0_rgba(26,26,26,1)] ${faded ? "opacity-60" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          {t.cover_photo && (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-ink bg-cream">
              <Image src={t.cover_photo} alt="" fill sizes="64px" className="object-cover" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full border-2 border-ink px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                  t.visibility === "public" ? "bg-flockie-orange text-white" : "bg-navy text-white"
                }`}
              >
                {t.visibility === "public" ? "Flock" : "Trip"}
              </span>
              {faded ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                    t.status === "cancelled" ? "bg-ink text-white" : "bg-[#06D6A0] text-white"
                  }`}
                >
                  {t.status === "cancelled" ? "Cancelled" : "Completed"}
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
              <CalendarClock size={13} /> {t.start_date} → {t.end_date} · {t.group_size} people
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
          <div className="flex shrink-0 items-center gap-2">
            {!faded && (
              <Link
                href={`/match/trip?id=${t.id}`}
                className="flex shrink-0 items-center gap-1 rounded-full border-2 border-ink bg-white px-3 py-1.5 text-sm font-bold"
              >
                <Pencil size={14} /> Edit
              </Link>
            )}
            <DeleteTripButton tripId={t.id} label={t.visibility === "public" ? "this Flock" : "this trip"} />
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
        <h1 className="text-2xl font-black">My Trips</h1>
        <Link
          href="/match/trip"
          className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-flockie-orange px-4 py-2 text-sm font-bold text-white shadow-[0_3px_0_0_#E0512C]"
        >
          <Plus size={16} /> New
        </Link>
      </div>
      <p className="mt-1 text-sm font-medium text-muted">Manage your trips and Flocks.</p>

      <div className="mt-6 space-y-3">
        {activeTrips.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-ink/30 py-12 text-center font-medium text-muted">
            No upcoming trips. Post one to start finding buddies.
          </div>
        ) : (
          pageTrips.map((t) => <TripCard key={t.id} t={t} />)
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} hrefFor={(p) => (p > 1 ? `/my-trips?page=${p}` : "/my-trips")} />

      {pastTrips.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-extrabold text-muted">Past trips &amp; Flocks</h2>
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
