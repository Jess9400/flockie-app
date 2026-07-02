import Link from "next/link";
import Image from "next/image";
import { Plus, Users, RefreshCw } from "lucide-react";
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

// Participant-side interest states shown in "In the running".
const INTEREST_LABEL: Record<string, string> = {
  interested: "Interested",
  shortlisted: "Shortlisted",
  invited: "You're invited",
  confirmed: "Confirmed",
};
const INTEREST_STYLE: Record<string, string> = {
  interested: "bg-flockie-blue text-white",
  shortlisted: "bg-flockie-orange text-white",
  invited: "bg-flockie-coral text-white",
  confirmed: "bg-[#06D6A0] text-white",
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
  searchParams: { page?: string; ppage?: string };
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

  const ppage = Math.max(1, Number(searchParams.ppage) || 1);
  const pastTotalPages = Math.max(1, Math.ceil(pastList.length / PAGE_SIZE));
  const pastPageList = pastList.slice((ppage - 1) * PAGE_SIZE, ppage * PAGE_SIZE);
  const qs = (params: Record<string, number>) => {
    const sp = new URLSearchParams();
    if (params.page > 1) sp.set("page", String(params.page));
    if (params.ppage > 1) sp.set("ppage", String(params.ppage));
    const s = sp.toString();
    return s ? `/my-vibes?${s}` : "/my-vibes";
  };

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

  // "In the running" — Vibes the user is a PARTICIPANT in (not hosting). These
  // otherwise have no home: interested/shortlisted/invited/confirmed rows never
  // surface, and 'reviewing'-status vibes drop out of browse/home entirely.
  // Own rows are readable by RLS; display data comes from vibe_directory (no GPS,
  // and — unlike the browse filters — it includes every status).
  const { data: myInterests } = await supabase
    .from("vibe_interests")
    .select("vibe_id, status")
    .eq("user_id", user!.id)
    .in("status", ["interested", "shortlisted", "invited", "confirmed"]);
  const interestStatus: Record<string, string> = {};
  (myInterests ?? []).forEach((r) => {
    if (!ids.includes(r.vibe_id)) interestStatus[r.vibe_id] = r.status; // skip own hosted
  });
  const runningIds = Object.keys(interestStatus);
  let running: {
    id: string;
    title: string;
    photos: string[] | null;
    city: string;
    area: string | null;
    starts_at: string;
    status: string;
  }[] = [];
  if (runningIds.length) {
    const { data: dir } = await supabase
      .from("vibe_directory")
      .select("id, title, photos, city, area, starts_at, status")
      .in("id", runningIds);
    running = (dir ?? []).sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    );
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
        {faded && (
          <div className="mt-3 border-t-2 border-ink/10 pt-3">
            <Link
              href={`/vibes/new?from=${v.id}`}
              className="flex items-center justify-center gap-1 rounded-full border-2 border-ink bg-flockie-orange py-2 text-xs font-bold text-white shadow-[0_2px_0_0_#E0512C]"
            >
              <RefreshCw size={13} /> Run it again
            </Link>
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
        Vibes you&rsquo;re hosting and the ones you&rsquo;ve joined.
      </p>

      {running.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-extrabold">In the running</h2>
          <p className="mt-0.5 text-xs font-medium text-muted">
            Vibes you&rsquo;ve joined — we&rsquo;ll let you know as the host picks their group.
          </p>
          <div className="mt-3 space-y-3">
            {running.map((v) => (
              <Link
                key={v.id}
                href={`/vibes/${v.id}`}
                className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-white p-3 shadow-[0_3px_0_0_rgba(26,26,26,1)]"
              >
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
                    {formatVibeWhen(v.starts_at)} · {v.area || v.city}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                    INTEREST_STYLE[interestStatus[v.id]] ?? "bg-cream text-ink"
                  }`}
                >
                  {INTEREST_LABEL[interestStatus[v.id]] ?? interestStatus[v.id]}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {(running.length > 0 || activeList.length > 0) && (
        <h2 className="mt-8 text-lg font-extrabold">Hosting</h2>
      )}
      <div className="mt-3 space-y-3">
        {activeList.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-ink/30 py-16 text-center font-medium text-muted">
            You haven&rsquo;t hosted an upcoming Vibe. Create your first one.
          </div>
        ) : (
          pageList.map((v) => <VibeRowCard key={v.id} v={v} />)
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} hrefFor={(p) => qs({ page: p, ppage })} />

      {pastList.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-extrabold text-muted">Past Vibes</h2>
          <div className="mt-3 space-y-3">
            {pastPageList.map((v) => (
              <VibeRowCard key={v.id} v={v} faded />
            ))}
          </div>
          <Pagination page={ppage} totalPages={pastTotalPages} hrefFor={(p) => qs({ page, ppage: p })} />
        </>
      )}
    </main>
  );
}
