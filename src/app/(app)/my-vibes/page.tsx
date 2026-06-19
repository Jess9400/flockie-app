import Link from "next/link";
import Image from "next/image";
import { Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ShareVibeButton from "@/components/ShareVibeButton";
import { formatVibeWhen } from "@/lib/vibes";

const STATUS_STYLE: Record<string, string> = {
  open: "bg-flockie-blue text-white",
  ranking: "bg-flockie-orange text-white",
  finalized: "bg-[#06D6A0] text-white",
  completed: "bg-cream text-ink",
  cancelled: "bg-ink text-white",
};

export default async function MyVibesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: vibes } = await supabase
    .from("vibes")
    .select("id, title, category, photos, city, location_name, starts_at, capacity, status")
    .eq("host_id", user!.id)
    .order("starts_at", { ascending: false });

  const list = vibes ?? [];
  const ids = list.map((v) => v.id);
  const counts: Record<string, number> = {};
  if (ids.length) {
    const { data: confirmed } = await supabase
      .from("vibe_interests")
      .select("vibe_id")
      .eq("status", "confirmed")
      .in("vibe_id", ids);
    confirmed?.forEach((r) => (counts[r.vibe_id] = (counts[r.vibe_id] ?? 0) + 1));
  }

  return (
    <main className="px-5 pb-10 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">My Vibes</h1>
        <Link
          href="/vibes/new"
          className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-flockie-orange px-4 py-2 text-sm font-bold text-white shadow-[0_3px_0_0_#E0512C]"
        >
          <Plus size={16} /> Create
        </Link>
      </div>
      <p className="mt-1 text-sm font-medium text-muted">
        Everything you&rsquo;ve hosted — manage matching, dates, and chats.
      </p>

      <div className="mt-6 space-y-3">
        {list.length === 0 && (
          <div className="rounded-3xl border-2 border-dashed border-ink/30 py-16 text-center font-medium text-muted">
            You haven&rsquo;t hosted a Vibe yet. Create your first one.
          </div>
        )}
        {list.map((v) => (
          <div
            key={v.id}
            className="rounded-2xl border-2 border-ink bg-white p-3 shadow-[0_3px_0_0_rgba(26,26,26,1)]"
          >
            <Link href={`/vibes/${v.id}`} className="flex items-center gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-cream">
                {v.photos?.[0] ? (
                  <Image src={v.photos[0]} alt="" fill sizes="48px" className="object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-lg">🎟️</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold">{v.title}</p>
                <p className="truncate text-xs font-medium text-muted">
                  {formatVibeWhen(v.starts_at)} · {v.location_name || v.city}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                    STATUS_STYLE[v.status] ?? "bg-cream text-ink"
                  }`}
                >
                  {v.status}
                </span>
                <span className="flex items-center gap-1 text-xs font-bold text-muted">
                  <Users size={13} /> {counts[v.id] ?? 0}/{v.capacity}
                </span>
              </div>
            </Link>
            {v.status === "open" && (
              <div className="mt-3 flex items-center justify-between gap-2 border-t-2 border-ink/10 pt-3">
                <p className="text-xs font-medium text-muted">Share to fill your room faster 🚀</p>
                <ShareVibeButton vibeId={v.id} />
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
