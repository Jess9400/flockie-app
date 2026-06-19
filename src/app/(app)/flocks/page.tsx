import Link from "next/link";
import Image from "next/image";
import { MapPin, CalendarClock, Users, Wallet, Gauge } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import FlockRequestButton from "@/components/FlockRequestButton";
import { loadFlockMatch } from "@/lib/vibe-stats";
import { BUDGET_LABELS, PACE_LABELS, tripDays } from "@/lib/trips";

type Member = { id: string; name: string; photo: string | null; isHost: boolean };

export default async function FlocksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: trips } = await supabase
    .from("trips")
    .select("id, user_id, destination, destinations, start_date, end_date, group_size, trip_type, budget, pace")
    .eq("visibility", "public")
    .eq("kind", "trip")
    .eq("status", "active")
    .neq("user_id", user!.id)
    .gte("end_date", new Date().toISOString().slice(0, 10))
    .order("start_date", { ascending: true })
    .limit(40);

  const list = trips ?? [];
  const ids = list.map((t) => t.id);

  // join requests (accepted = going; mine = requested)
  const accepted: Record<string, string[]> = {};
  const requested = new Set<string>();
  if (ids.length) {
    const { data: reqs } = await supabase
      .from("trip_join_requests")
      .select("trip_id, user_id, status")
      .in("trip_id", ids);
    reqs?.forEach((r) => {
      if (r.status === "accepted") (accepted[r.trip_id] ??= []).push(r.user_id);
      if (r.user_id === user!.id) requested.add(r.trip_id);
    });
  }

  // profiles for hosts + accepted members
  const peopleIds = Array.from(
    new Set([...list.map((t) => t.user_id), ...Object.values(accepted).flat()])
  );
  const profiles: Record<string, { display_name: string | null; photos: string[] | null }> = {};
  if (peopleIds.length) {
    const { data: pp } = await supabase
      .from("profiles")
      .select("id, display_name, photos")
      .in("id", peopleIds);
    pp?.forEach((p) => (profiles[p.id] = { display_name: p.display_name, photos: p.photos }));
  }

  const matches = await loadFlockMatch(supabase, ids);

  return (
    <main className="px-5 pb-10 pt-6">
      <h1 className="text-2xl font-black">Find a Flock</h1>
      <p className="mt-1 text-sm font-medium text-muted">
        Open <span className="font-bold">group trips</span> you can request to
        join. (Group activities live in Vibes.)
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-full border-2 border-ink bg-white p-1 text-sm font-bold">
        <Link href="/match" className="rounded-full py-2 text-center text-ink">Find a Buddy</Link>
        <span className="rounded-full bg-flockie-blue py-2 text-center text-white">Find a Flock</span>
      </div>

      <div className="mt-6 space-y-3">
        {list.length === 0 && (
          <div className="rounded-3xl border-2 border-dashed border-ink/30 py-16 text-center font-medium text-muted">
            No open trips yet. Post a trip and set it to Public to start a Flock.
          </div>
        )}
        {list.map((t) => {
          const days = tripDays(t.start_date, t.end_date);
          const pct = matches[t.id];
          const members: Member[] = [
            { id: t.user_id, name: profiles[t.user_id]?.display_name || "Host", photo: profiles[t.user_id]?.photos?.[0] ?? null, isHost: true },
            ...(accepted[t.id] ?? []).map((uid) => ({
              id: uid,
              name: profiles[uid]?.display_name || "Flockie",
              photo: profiles[uid]?.photos?.[0] ?? null,
              isHost: false,
            })),
          ];
          const going = members.length;
          return (
            <div
              key={t.id}
              className="rounded-2xl border-2 border-ink bg-white p-4 shadow-[0_3px_0_0_rgba(26,26,26,1)]"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {members[0].photo ? (
                    <Image src={members[0].photo} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-flockie-blue text-xs font-bold text-white">
                      {members[0].name[0]}
                    </span>
                  )}
                  <span className="text-sm font-bold">{members[0].name}</span>
                </div>
                {typeof pct === "number" && (
                  <span className="shrink-0 rounded-full bg-flockie-blue px-2.5 py-0.5 text-xs font-bold text-white">
                    ✨ {pct}% your vibe
                  </span>
                )}
              </div>

              <p className="mt-2 flex items-center gap-1.5 font-extrabold">
                <MapPin size={15} className="text-flockie-orange" />{" "}
                {(t.destinations ?? [t.destination]).filter(Boolean).join(" · ")}
              </p>

              <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                <CalendarClock size={13} /> {t.start_date} → {t.end_date}
                {days > 0 && <span className="font-bold text-ink/70">· {days} days</span>}
              </p>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold text-ink">
                  <Users size={12} /> {going}/{t.group_size} going
                </span>
                {t.budget != null && (
                  <span className="flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold text-ink">
                    <Wallet size={12} /> {BUDGET_LABELS[t.budget - 1]}
                  </span>
                )}
                {t.pace != null && (
                  <span className="flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold text-ink">
                    <Gauge size={12} /> {PACE_LABELS[t.pace - 1]}
                  </span>
                )}
              </div>

              {/* confirmed members — tap to view profile */}
              <div className="mt-3 flex items-center gap-1">
                {members.slice(0, 6).map((m) => (
                  <Link key={m.id} href={`/people/${m.id}`} title={m.name} className="relative">
                    {m.photo ? (
                      <Image src={m.photo} alt={m.name} width={32} height={32} className="h-8 w-8 rounded-full border-2 border-white object-cover ring-1 ring-ink/10" />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-flockie-blue text-xs font-bold text-white ring-1 ring-ink/10">
                        {m.name[0]}
                      </span>
                    )}
                    {m.isHost && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-flockie-orange px-1 text-[8px] font-bold text-white">
                        host
                      </span>
                    )}
                  </Link>
                ))}
                {members.length > 6 && (
                  <span className="ml-1 text-xs font-bold text-muted">+{members.length - 6}</span>
                )}
              </div>

              {(t.trip_type?.length ?? 0) > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.trip_type!.map((tag: string) => (
                    <span key={tag} className="rounded-full border-2 border-ink px-2.5 py-0.5 text-[11px] font-bold">{tag}</span>
                  ))}
                </div>
              )}

              <div className="mt-3">
                <FlockRequestButton tripId={t.id} requested={requested.has(t.id)} />
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
