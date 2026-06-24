import Link from "next/link";
import Image from "next/image";
import { Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ShareVibeButton from "@/components/ShareVibeButton";
import PageTabs from "@/components/PageTabs";
import Pagination from "@/components/Pagination";
import { formatVibeWhen } from "@/lib/vibes";

const VIBE_TABS = [
  { href: "/vibes", label: "Vibes" },
  { href: "/my-vibes", label: "My Vibes" },
];

const PAGE_SIZE = 5;

const STATUS_STYLE: Record<string, string> = {
  open: "bg-flockie-blue text-white",
  ranking: "bg-flockie-orange text-white",
  finalized: "bg-[#06D6A0] text-white",
  completed: "bg-cream text-ink",
  cancelled: "bg-ink text-white",
};

type VibeRow = {
  id: string;
  title: string;
  category: string;
  photos: string[] | null;
  city: string;
  location_name: string | null;
  starts_at: string;
  ends_at: string | null;
  capacity: number;
  status: string;
};

export default async function MyVibesPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: vibes } = await supabase
    .from("vibes")
    .select("id, title, category, photos, city, location_name, starts_at, ends_at, capacity, status")
    .eq("host_id", user!.id)
    .order("starts_at", { ascending: false });

  const all = (vibes ?? []) as VibeRow[];
  const now = Date.now();
  const isPast = (v: VibeRow) =>
    v.status === "completed" ||
    v.status === "cancelled" ||
    new Date(v.ends_at ?? v.starts_at).getTime() < now;
  const activeList = all.filter((v) => !isPast(v));
  const pastList = all.filter(isPast);

  const page = Math.max(1, Number(searchParams.page) || 1);
  const totalPages = Math.max(1, Math.ceil(activeList.length / PAGE_SIZE));
  const pageList = activeList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts: Record<string, number> = {};
  const ids = all.map((v) => v.id);
  if (ids.length) {
    const { data: confirmed } = await supabase
      .from("vibe_interests")
      .select("vibe_id")
      .eq("status", "confirmed")
      .in("vibe_id", ids);
    confirmed?.forEach((r) => (counts[r.vibe_id] = (counts[r.vibe_id] ?? 0) + 1));
  }

  function VibeRowCard({ v, faded }: { v: VibeRow; faded?: boolean }) {
    return (
      <div
        className={`rounded-2xl border-2 border-ink bg-white p-3 shadow-[0_3px_0_0_rgba(26,26,26,1)] ${faded ? "opacity-60" : ""}`}
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
                faded
                  ? v.status === "cancelled"
                    ? "bg-ink text-white"
                    : "bg-[#06D6A0] text-white"
                  : STATUS_STYLE[v.status] ?? "bg-cream text-ink"
              }`}
            >
              {faded ? (v.status === "cancelled" ? "Cancelled" : "Completed") : v.status}
            </span>
            <span className="flex items-center gap-1 text-xs font-bold text-muted">
              <Users size={13} /> {counts[v.id] ?? 0}/{v.capacity}
            </span>
          </div>
        </Link>
        {!faded && v.status === "open" && (
          <div className="mt-3 flex items-center justify-between gap-2 border-t-2 border-ink/10 pt-3">
            <p className="text-xs font-medium text-muted">Share to fill your room faster 🚀</p>
            <ShareVibeButton vibeId={v.id} />
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="px-5 pb-10 pt-6">
      <PageTabs tabs={VIBE_TABS} />
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
        {activeList.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-ink/30 py-16 text-center font-medium text-muted">
            You haven&rsquo;t hosted an upcoming Vibe. Create your first one.
          </div>
        ) : (
          pageList.map((v) => <VibeRowCard key={v.id} v={v} />)
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} hrefFor={(p) => (p > 1 ? `/my-vibes?page=${p}` : "/my-vibes")} />

      {pastList.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-extrabold text-muted">Past Vibes</h2>
          <div className="mt-3 space-y-3">
            {pastList.map((v) => (
              <VibeRowCard key={v.id} v={v} faded />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
