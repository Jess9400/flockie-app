import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil, MapPin, CalendarClock, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

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
    .select("id, destination, start_date, end_date, group_size, trip_type, status, created_at")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  const { data: matches } = await supabase.rpc("my_matches");
  const list = (matches ?? []) as Match[];

  return (
    <main className="px-5 pb-10 pt-6">
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
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-extrabold">
                  <MapPin size={15} className="text-flockie-orange" /> {t.destination}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-muted">
                  <CalendarClock size={13} /> {t.start_date} → {t.end_date} · {t.group_size} people
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
              <Link
                href={`/match/trip?id=${t.id}`}
                className="flex shrink-0 items-center gap-1 rounded-full border-2 border-ink bg-white px-3 py-1.5 text-sm font-bold"
              >
                <Pencil size={14} /> Edit
              </Link>
            </div>
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
