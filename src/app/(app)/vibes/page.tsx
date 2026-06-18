import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import VibeCard, { type VibeCardData } from "@/components/VibeCard";
import type { InterestStatus } from "@/lib/vibes";

export default async function VibesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("activities, home_city")
    .eq("id", user!.id)
    .single();

  const activityCheckDone = (profile?.activities ?? []).length > 0;

  const { data: vibes } = await supabase
    .from("vibes")
    .select(
      "id, host_id, title, category, photos, city, location_name, starts_at, capacity, event_vibe_tags"
    )
    .gte("starts_at", new Date().toISOString())
    .in("status", ["open", "ranking", "finalized"])
    .order("starts_at", { ascending: true })
    .limit(20);

  const list = vibes ?? [];
  const ids = list.map((v) => v.id);
  const hostIds = Array.from(new Set(list.map((v) => v.host_id)));

  // hosts, confirmed counts, my statuses — separate queries (no fragile embeds)
  const hosts: Record<string, { display_name: string | null; photos: string[] | null }> = {};
  const counts: Record<string, number> = {};
  const mine: Record<string, InterestStatus> = {};

  if (hostIds.length) {
    const { data: hp } = await supabase
      .from("profiles")
      .select("id, display_name, photos")
      .in("id", hostIds);
    hp?.forEach((h) => {
      hosts[h.id] = { display_name: h.display_name, photos: h.photos };
    });
  }

  if (ids.length) {
    const { data: confirmed } = await supabase
      .from("vibe_interests")
      .select("vibe_id")
      .eq("status", "confirmed")
      .in("vibe_id", ids);
    confirmed?.forEach((r) => {
      counts[r.vibe_id] = (counts[r.vibe_id] ?? 0) + 1;
    });

    const { data: myInterests } = await supabase
      .from("vibe_interests")
      .select("vibe_id, status")
      .eq("user_id", user!.id)
      .in("vibe_id", ids);
    myInterests?.forEach((r) => {
      mine[r.vibe_id] = r.status as InterestStatus;
    });
  }

  return (
    <main className="px-5 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Vibes</h1>
        <Link
          href="/vibes/new"
          className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-flockie-orange px-4 py-2 text-sm font-bold text-white shadow-[0_3px_0_0_#E0512C]"
        >
          <Plus size={16} /> Create
        </Link>
      </div>
      <p className="mt-1 text-sm font-medium text-muted">
        Activities anyone can host. Tap &ldquo;I&rsquo;m interested&rdquo; and the
        host&rsquo;s algorithm invites the most compatible people, up to capacity.
        First-come isn&rsquo;t how it works here.
      </p>

      {!activityCheckDone && (
        <Link
          href="/profile"
          className="mt-4 block rounded-2xl border-2 border-ink bg-flockie-blue p-3 text-sm font-bold text-white"
        >
          Complete your activity vibe check to unlock smart matching →
        </Link>
      )}

      <div className="mt-6 space-y-4">
        {list.length === 0 && (
          <div className="rounded-3xl border-2 border-dashed border-ink/30 py-16 text-center font-medium text-muted">
            No Vibes yet. Be the first to create one.
          </div>
        )}
        {list.map((v) => (
          <VibeCard
            key={v.id}
            vibe={{ ...v, host: hosts[v.host_id] ?? null } as VibeCardData}
            confirmedCount={counts[v.id] ?? 0}
            myStatus={mine[v.id] ?? null}
          />
        ))}
      </div>
    </main>
  );
}
