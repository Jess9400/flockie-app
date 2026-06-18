import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import VibeCard, { type VibeCardData } from "@/components/VibeCard";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user!.id)
    .maybeSingle();

  const { data: vibes } = await supabase
    .from("vibes")
    .select(
      "id, host_id, title, category, photos, city, location_name, starts_at, capacity, event_vibe_tags"
    )
    .gte("starts_at", new Date().toISOString())
    .in("status", ["open", "ranking", "finalized"])
    .order("starts_at", { ascending: true })
    .limit(8);

  const list = vibes ?? [];
  const hostIds = Array.from(new Set(list.map((v) => v.host_id)));
  const ids = list.map((v) => v.id);
  const hosts: Record<string, { display_name: string | null; photos: string[] | null }> = {};
  const counts: Record<string, number> = {};

  if (hostIds.length) {
    const { data: hp } = await supabase
      .from("profiles")
      .select("id, display_name, photos")
      .in("id", hostIds);
    hp?.forEach((h) => (hosts[h.id] = { display_name: h.display_name, photos: h.photos }));
  }
  if (ids.length) {
    const { data: confirmed } = await supabase
      .from("vibe_interests")
      .select("vibe_id")
      .eq("status", "confirmed")
      .in("vibe_id", ids);
    confirmed?.forEach((r) => (counts[r.vibe_id] = (counts[r.vibe_id] ?? 0) + 1));
  }

  const name = profile?.display_name?.trim();

  return (
    <div className="px-5 pt-6">
      <h1 className="px-1 text-2xl font-black">
        {name ? `Hey ${name} 👋` : "Welcome to Flockie 🕊️"}
      </h1>
      <p className="mt-1 px-1 font-medium text-muted">
        Find compatible people to do anything with, near you or anywhere.
      </p>

      {/* Join a vibe */}
      <section className="mt-8">
        <div className="flex items-end justify-between px-1">
          <div>
            <h2 className="text-xl font-extrabold">Join a Vibe</h2>
            <p className="text-sm font-medium text-muted">
              Activities happening near you. Tap one you like.
            </p>
          </div>
          <Link
            href="/vibes"
            className="flex items-center gap-1 text-sm font-bold text-flockie-orange"
          >
            See all <ArrowRight size={15} />
          </Link>
        </div>

        {list.length === 0 ? (
          <Link
            href="/vibes/new"
            className="mt-4 flex items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-ink/30 py-12 font-bold text-muted"
          >
            <Plus size={18} /> No Vibes yet — create the first
          </Link>
        ) : (
          <div className="mt-4 flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {list.map((v) => (
              <div key={v.id} className="w-72 shrink-0 snap-start">
                <VibeCard
                  vibe={{ ...v, host: hosts[v.host_id] ?? null } as VibeCardData}
                  confirmedCount={counts[v.id] ?? 0}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Find your people */}
      <section className="mt-10">
        <h2 className="px-1 text-xl font-extrabold">Find your people</h2>
        <p className="px-1 text-sm font-medium text-muted">
          A travel buddy for your next trip, or a whole flock to go with.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border-2 border-ink bg-flockie-blue p-5 text-white shadow-[0_5px_0_0_rgba(26,26,26,1)]">
            <p className="text-2xl">🧳</p>
            <h3 className="mt-2 text-lg font-extrabold">Find a travel buddy</h3>
            <p className="mt-1 text-sm font-medium text-white/90">
              Swipe vibe-matched people heading where you want to go.
            </p>
            <Link
              href="/match"
              className="mt-4 inline-flex items-center gap-1 rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-bold text-ink"
            >
              Start swiping <ArrowRight size={15} />
            </Link>
          </div>

          <div className="rounded-3xl border-2 border-ink bg-flockie-orange p-5 text-white shadow-[0_5px_0_0_rgba(26,26,26,1)]">
            <p className="text-2xl">🪺</p>
            <h3 className="mt-2 text-lg font-extrabold">Create a Flock</h3>
            <p className="mt-1 text-sm font-medium text-white/90">
              Start a group trip and let compatible travelers join.
            </p>
            <Link
              href="/match"
              className="mt-4 inline-flex items-center gap-1 rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-bold text-ink"
            >
              Find a flock <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
