import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil, MapPin, CalendarClock, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import FlockJoinRequests, { type JoinReq } from "@/components/FlockJoinRequests";
import DeleteTripButton from "@/components/DeleteTripButton";
import PageTabs from "@/components/PageTabs";

const TRIP_TABS = [
  { href: "/my-trips", label: "My Trips" },
  { href: "/my-activities", label: "My Activities" },
  { href: "/deals", label: "Deals" },
];

type Match = {
  chat_id: string;
  other_id: string;
  display_name: string | null;
  age: number | null;
  photos: string[] | null;
  one_liner: string | null;
  score: number;
};

export default async function MyTripsPage() {
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

  const { data: matches } = await supabase.rpc("my_matches");
  const list = (matches ?? []) as Match[];

  // Join requests to my trips (host approval)
  const myTripIds = (trips ?? []).map((t) => t.id);

  // Which of my trips are converted Flocks (have a co-host → dual approval)?
  // Separate query so the page still works before flock-from-buddy.sql is applied.
  const coHostTrips = new Set<string>();
  if (myTripIds.length) {
    const { data: ch } = await supabase
      .from("trips")
      .select("id")
      .in("id", myTripIds)
      .not("co_host_id", "is", null);
    ch?.forEach((r) => coHostTrips.add(r.id));
  }
  const reqByTrip: Record<string, JoinReq[]> = {};
  if (myTripIds.length) {
    const { data: jr } = await supabase
      .from("trip_join_requests")
      .select("trip_id, user_id, status")
      .in("trip_id", myTripIds);
    const reqUserIds = Array.from(new Set((jr ?? []).map((r) => r.user_id)));
    const rp: Record<string, { display_name: string | null; age: number | null; photos: string[] | null; one_liner: string | null }> = {};
    if (reqUserIds.length) {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, age, photos, one_liner")
        .in("id", reqUserIds);
      data?.forEach((p) => (rp[p.id] = p));
    }
    (jr ?? []).forEach((r) => {
      (reqByTrip[r.trip_id] ??= []).push({
        userId: r.user_id,
        status: r.status,
        name: rp[r.user_id]?.display_name || "Flockie",
        age: rp[r.user_id]?.age ?? null,
        photo: rp[r.user_id]?.photos?.[0] ?? null,
        oneLiner: rp[r.user_id]?.one_liner ?? null,
      });
    });
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
      <p className="mt-1 text-sm font-medium text-muted">
        Manage your trips and your travel-buddy matches.
      </p>

      {/* Trips */}
      <div className="mt-6 space-y-3">
        {(trips ?? []).length === 0 && (
          <div className="rounded-3xl border-2 border-dashed border-ink/30 py-12 text-center font-medium text-muted">
            No trips yet. Post one to start finding buddies.
          </div>
        )}
        {(trips ?? []).map((t) => (
          <div
            key={t.id}
            className="rounded-2xl border-2 border-ink bg-white p-4 shadow-[0_3px_0_0_rgba(26,26,26,1)]"
          >
            <div className="flex items-start justify-between gap-3">
              {t.cover_photo && (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-ink">
                  <Image src={t.cover_photo} alt="" fill sizes="64px" className="object-cover" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border-2 border-ink px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                      t.kind === "activity"
                        ? "bg-flockie-blue text-white"
                        : t.visibility === "public"
                          ? "bg-flockie-orange text-white"
                          : "bg-cream text-ink"
                    }`}
                  >
                    {t.kind === "activity" ? "Activity" : t.visibility === "public" ? "Flock" : "Trip"}
                  </span>
                  {t.status !== "active" && (
                    <span className="text-[10px] font-bold uppercase text-muted">{t.status}</span>
                  )}
                </div>
                <p className="mt-1 flex items-center gap-1.5 font-extrabold">
                  <MapPin size={15} className="text-flockie-orange" />{" "}
                  {t.kind === "activity" && t.title
                    ? t.title
                    : (t.destinations ?? [t.destination]).filter(Boolean).join(" · ")}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-muted">
                  <CalendarClock size={13} /> {t.start_date} → {t.end_date}
                  {t.kind !== "activity" && ` · ${t.group_size} people`}
                </p>
                {(t.trip_type?.length ?? 0) > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {t.trip_type!.map((tag: string) => (
                      <span key={tag} className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-bold">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/match/trip?id=${t.id}`}
                  className="flex shrink-0 items-center gap-1 rounded-full border-2 border-ink bg-white px-3 py-1.5 text-sm font-bold"
                >
                  <Pencil size={14} /> Edit
                </Link>
                <DeleteTripButton
                  tripId={t.id}
                  label={
                    t.kind === "activity"
                      ? (t.title ? `"${t.title}"` : "this activity")
                      : t.visibility === "public"
                        ? "this Flock"
                        : "this trip"
                  }
                />
              </div>
            </div>
            {reqByTrip[t.id]?.length ? (
              <FlockJoinRequests tripId={t.id} requests={reqByTrip[t.id]} dualApproval={coHostTrips.has(t.id)} canRemove />
            ) : null}
          </div>
        ))}
      </div>

      {/* Matches */}
      <h2 className="mt-8 text-lg font-extrabold">Your buddy matches</h2>
      <div className="mt-3 space-y-3">
        {list.length === 0 && (
          <div className="rounded-3xl border-2 border-dashed border-ink/30 py-12 text-center font-medium text-muted">
            No matches yet. Swipe in Find a Buddy to get matching.
          </div>
        )}
        {list.map((m) => (
          <div
            key={m.chat_id}
            className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-white p-3 shadow-[0_3px_0_0_rgba(26,26,26,1)]"
          >
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-flockie-blue">
              {m.photos?.[0] ? (
                <Image src={m.photos[0]} alt="" fill sizes="56px" className="object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-lg font-black text-white">
                  {(m.display_name || "F")[0]}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-extrabold">
                {m.display_name || "Flockie"}
                {m.age ? `, ${m.age}` : ""}
              </p>
              <p className="text-xs font-bold text-flockie-orange">
                {Math.round(m.score)}% match
              </p>
              {m.one_liner && (
                <p className="truncate text-xs font-medium text-muted">{m.one_liner}</p>
              )}
            </div>
            <Link
              href={`/buddies/${m.chat_id}`}
              className="flex shrink-0 items-center gap-1 rounded-full border-2 border-ink bg-flockie-orange px-3 py-2 text-sm font-bold text-white shadow-[0_3px_0_0_#E0512C]"
            >
              <MessageCircle size={14} /> Chat
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}
