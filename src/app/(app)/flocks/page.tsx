import Link from "next/link";
import Image from "next/image";
import { MapPin, CalendarClock, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import FlockRequestButton from "@/components/FlockRequestButton";

export default async function FlocksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: trips } = await supabase
    .from("trips")
    .select("id, user_id, destination, start_date, end_date, group_size, trip_type")
    .eq("visibility", "public")
    .eq("status", "active")
    .neq("user_id", user!.id)
    .gte("end_date", new Date().toISOString().slice(0, 10))
    .order("start_date", { ascending: true })
    .limit(40);

  const list = trips ?? [];
  const hostIds = Array.from(new Set(list.map((t) => t.user_id)));
  const ids = list.map((t) => t.id);

  const hosts: Record<string, { display_name: string | null; photos: string[] | null }> = {};
  if (hostIds.length) {
    const { data: hp } = await supabase
      .from("profiles")
      .select("id, display_name, photos")
      .in("id", hostIds);
    hp?.forEach((h) => (hosts[h.id] = { display_name: h.display_name, photos: h.photos }));
  }

  const requested = new Set<string>();
  if (ids.length) {
    const { data: reqs } = await supabase
      .from("trip_join_requests")
      .select("trip_id")
      .eq("user_id", user!.id)
      .in("trip_id", ids);
    reqs?.forEach((r) => requested.add(r.trip_id));
  }

  return (
    <main className="px-5 pb-10 pt-6">
      <h1 className="text-2xl font-black">Find a Flock</h1>
      <p className="mt-1 text-sm font-medium text-muted">
        Open group trips you can request to join.
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
          const host = hosts[t.user_id];
          return (
            <div
              key={t.id}
              className="rounded-2xl border-2 border-ink bg-white p-4 shadow-[0_3px_0_0_rgba(26,26,26,1)]"
            >
              <div className="flex items-center gap-2">
                {host?.photos?.[0] ? (
                  <Image src={host.photos[0]} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-flockie-blue text-xs font-bold text-white">
                    {(host?.display_name || "F")[0]}
                  </span>
                )}
                <span className="text-sm font-bold">{host?.display_name || "A flockie"}</span>
              </div>
              <p className="mt-2 flex items-center gap-1.5 font-extrabold">
                <MapPin size={15} className="text-flockie-orange" /> {t.destination}
              </p>
              <p className="mt-0.5 flex items-center gap-3 text-xs font-medium text-muted">
                <span className="flex items-center gap-1"><CalendarClock size={13} /> {t.start_date} → {t.end_date}</span>
                <span className="flex items-center gap-1"><Users size={13} /> {t.group_size}</span>
              </p>
              {(t.trip_type?.length ?? 0) > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {t.trip_type!.map((tag: string) => (
                    <span key={tag} className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-bold">{tag}</span>
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
