import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import VibeCard, { type VibeCardData } from "@/components/VibeCard";

const HERO_PHOTOS = [
  { src: "https://images.unsplash.com/photo-1562278996-b055b6a1190f?auto=format&fit=crop&w=600&q=80", label: "Skydive" },
  { src: "https://images.unsplash.com/photo-1678030523822-cf542960e377?auto=format&fit=crop&w=600&q=80", label: "Camel ride" },
  { src: "https://images.unsplash.com/photo-1666276845220-7b94f61e3d35?auto=format&fit=crop&w=600&q=80", label: "Surf" },
  { src: "https://images.unsplash.com/photo-1634294007943-f24d8c9e7d39?auto=format&fit=crop&w=600&q=80", label: "Dinner" },
];

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
        Find compatible, vibe-checked people to do anything with, near you or
        anywhere.
      </p>

      {/* activity photos */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {HERO_PHOTOS.map((p, i) => (
          <figure
            key={p.label}
            className={`relative overflow-hidden rounded-2xl border-2 border-ink ${
              i % 2 ? "rotate-[1.5deg]" : "rotate-[-1.5deg]"
            }`}
          >
            <span className="absolute left-1.5 top-1.5 z-10 rounded-full border-2 border-ink bg-white px-2 py-0.5 text-[10px] font-extrabold">
              {p.label}
            </span>
            <Image
              src={p.src}
              alt={p.label}
              width={300}
              height={300}
              className="h-28 w-full object-cover sm:h-32"
            />
          </figure>
        ))}
      </div>

      {/* how it works */}
      <div className="mt-6 rounded-3xl border-2 border-ink bg-white p-5 shadow-[0_5px_0_0_rgba(26,26,26,1)]">
        <p className="text-lg font-extrabold">How Flockie works</p>
        <ol className="mt-3 space-y-2 text-sm font-medium text-ink/80">
          <li>
            <b className="text-ink">1. Build your vibe check.</b> A few honest
            questions about how you travel and hang out.
          </li>
          <li>
            <b className="text-ink">2. Match on vibe.</b> The algorithm finds the
            most compatible people, not random ones.
          </li>
          <li>
            <b className="text-ink">3. Plan &amp; go.</b> A group chat opens, you
            sort the details, and you&rsquo;re off.
          </li>
        </ol>
      </div>

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
              href="/flocks"
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
