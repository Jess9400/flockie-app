import { Fragment } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, MessageCircle, MapPin, RefreshCw } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import ShareVibeButton from "@/components/ShareVibeButton";
import PageTabs from "@/components/PageTabs";
import Pagination from "@/components/Pagination";
import { formatVibeWhen } from "@/lib/vibes";

const PAGE_SIZE = 5;

const STATUS_STYLE: Record<string, string> = {
  open: "bg-flockie-blue text-white",
  ranking: "bg-flockie-orange text-white",
  finalized: "bg-[#06D6A0] text-white",
  completed: "bg-cream text-ink",
  cancelled: "bg-ink text-white",
};

const CARD = "rounded-2xl border border-ink/15 bg-white p-3 shadow-[0_2px_10px_rgba(10,37,69,0.08)]";
const GHOST_BTN =
  "flex items-center justify-center gap-1.5 rounded-full border border-ink/15 bg-white py-2 text-xs font-bold text-ink";

// Google Maps search deep-link from a place label.
const mapsUrl = (q: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

type VibeRow = {
  id: string;
  title: string;
  category: string;
  photos: string[] | null;
  city: string;
  location_name: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string | null;
  capacity: number;
  status: string;
};

type JoinedVibe = {
  id: string;
  title: string;
  photos: string[] | null;
  city: string;
  area: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string | null;
  status: string;
};

export default async function MyVibesPage({
  searchParams,
}: {
  searchParams: { page?: string; ppage?: string };
}) {
  const supabase = await createClient();
  const user = await getSessionUser();
  const t = await getTranslations("myVibes");
  const locale = await getLocale();

  const ta = await getTranslations("activities");
  const VIBE_TABS = [
    { href: "/my-vibes", label: t("tabMyVibes") },
    { href: "/my-activities", label: ta("tabActivities") },
    { href: "/deals", label: ta("tabDeals") },
    { href: "/my-trips", label: ta("tabTrips") },
  ];

  const { data: vibes } = await supabase
    .from("vibes")
    .select("id, title, category, photos, city, location_name, starts_at, ends_at, timezone, capacity, status")
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

  // "In the running" / "You're going" — Vibes the user is a PARTICIPANT in (not
  // hosting). Own rows are readable by RLS; display data comes from
  // vibe_directory (no GPS, and — unlike browse filters — it includes every status).
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
  let going: JoinedVibe[] = [];
  let running: JoinedVibe[] = [];
  let attendedPast: JoinedVibe[] = [];
  if (runningIds.length) {
    const { data: dir } = await supabase
      .from("vibe_directory")
      .select("id, title, photos, city, area, starts_at, ends_at, timezone, status")
      .in("id", runningIds);
    const rows = (dir ?? []) as JoinedVibe[];
    const hasEnded = (v: JoinedVibe) => new Date(v.ends_at ?? v.starts_at).getTime() < now;
    const byStart = (a: JoinedVibe, b: JoinedVibe) =>
      new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    const upcoming = rows.filter((v) => v.status !== "cancelled" && !hasEnded(v));
    going = upcoming.filter((v) => interestStatus[v.id] === "confirmed").sort(byStart);
    running = upcoming.filter((v) => interestStatus[v.id] !== "confirmed").sort(byStart);
    attendedPast = rows
      .filter((v) => interestStatus[v.id] === "confirmed" && hasEnded(v))
      .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
  }

  const twoCol = going.length > 0 && running.length > 0;
  const hasPast = pastList.length > 0 || attendedPast.length > 0;

  function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
      <p className="mb-2 mt-6 text-xs font-extrabold uppercase tracking-wide text-muted">{children}</p>
    );
  }

  function Thumb({ photo, emoji = "🎟️" }: { photo?: string | null; emoji?: string }) {
    return (
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-cream">
        {photo ? (
          <Image src={photo} alt="" fill sizes="48px" className="object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-lg">{emoji}</span>
        )}
      </div>
    );
  }

  // Interested → Shortlisted → Invited progress, mirrors the vibe detail stepper.
  function Stepper({ status }: { status: string }) {
    const steps = ["interested", "shortlisted", "invited"] as const;
    const cur = Math.max(0, steps.indexOf(status as (typeof steps)[number]));
    return (
      <div className="mt-3 flex items-start">
        {steps.map((s, i) => (
          <Fragment key={s}>
            <div className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className={`h-3 w-3 rounded-full border-2 ${
                  i < cur
                    ? "border-[#06D6A0] bg-[#06D6A0]"
                    : i === cur
                      ? "border-flockie-coral bg-white ring-2 ring-flockie-coral/25"
                      : "border-ink/20 bg-cream"
                }`}
              />
              <span className={`text-[10px] font-bold ${i <= cur ? "text-ink" : "text-muted"}`}>
                {t(`step.${s}`)}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className={`mt-[5px] h-0.5 flex-1 ${i < cur ? "bg-[#06D6A0]" : "bg-ink/15"}`} />
            )}
          </Fragment>
        ))}
      </div>
    );
  }

  // Hosting card: fill meter + Share-to-fill + Manage. `faded` = a past host.
  function HostingCard({ v, faded }: { v: VibeRow; faded?: boolean }) {
    const filled = counts[v.id] ?? 0;
    const pct = v.capacity > 0 ? Math.min(100, Math.round((filled / v.capacity) * 100)) : 0;
    const shareEligible =
      ["open", "reviewing", "ranking", "finalized"].includes(v.status) && filled < v.capacity;
    return (
      <div className={`${CARD} ${faded ? "opacity-60" : ""}`}>
        <div className="flex items-center gap-3">
          <Link href={`/vibes/${v.id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Thumb photo={v.photos?.[0]} />
            <div className="min-w-0">
              <p className="truncate font-extrabold">{v.title}</p>
              <p className="truncate text-xs font-medium text-muted">
                {formatVibeWhen(v.starts_at, locale, v.timezone)} · {v.location_name || v.city}
              </p>
            </div>
          </Link>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
              faded
                ? v.status === "cancelled"
                  ? "bg-ink text-white"
                  : "bg-[#06D6A0] text-white"
                : STATUS_STYLE[v.status] ?? "bg-cream text-ink"
            }`}
          >
            {faded
              ? v.status === "cancelled"
                ? t("status.cancelled")
                : t("status.completed")
              : t(`status.${v.status}`)}
          </span>
        </div>

        {!faded && (
          <div className="mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-cream">
              <div className="h-full rounded-full bg-flockie-coral" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-muted">
                {t("seatsFilled", { filled, capacity: v.capacity })}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                {shareEligible && <ShareVibeButton vibeId={v.id} fill />}
                <Link
                  href={`/vibes/${v.id}`}
                  className="rounded-full border border-ink/15 bg-white px-3.5 py-1.5 text-xs font-bold text-ink"
                >
                  {t("manage")}
                </Link>
              </div>
            </div>
          </div>
        )}

        {faded && (
          <div className="mt-3 border-t-2 border-ink/10 pt-3">
            <Link
              href={`/vibes/new?from=${v.id}`}
              className="flex items-center justify-center gap-1 rounded-full border border-ink/15 bg-flockie-orange py-2 text-xs font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
            >
              <RefreshCw size={13} /> {t("runAgain")}
            </Link>
          </div>
        )}
      </div>
    );
  }

  // "You're going" — confirmed, green card with chat + directions inline.
  function GoingCard({ v }: { v: JoinedVibe }) {
    const place = [v.area, v.city].filter(Boolean).join(", ");
    return (
      <div className={`${CARD} border-[#06D6A0] bg-[#E9F6F1]`}>
        <div className="flex items-center gap-3">
          <Link href={`/vibes/${v.id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Thumb photo={v.photos?.[0]} />
            <div className="min-w-0">
              <p className="truncate font-extrabold">{v.title}</p>
              <p className="truncate text-xs font-medium text-muted">
                {formatVibeWhen(v.starts_at, locale, v.timezone)}
                {place ? ` · ${place}` : ""}
              </p>
            </div>
          </Link>
          <span className="shrink-0 rounded-full bg-[#06D6A0] px-2.5 py-0.5 text-[11px] font-extrabold text-white">
            {t("interest.confirmed")}
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          <Link href={`/vibes/${v.id}/chat`} className={`flex-1 ${GHOST_BTN}`}>
            <MessageCircle size={14} /> {t("openChat")}
          </Link>
          {place && (
            <a href={mapsUrl(place)} target="_blank" rel="noopener noreferrer" className={`flex-1 ${GHOST_BTN}`}>
              <MapPin size={14} /> {t("directions")}
            </a>
          )}
        </div>
      </div>
    );
  }

  // "In the running" — pending, carries the mini-stepper.
  function RunningCard({ v }: { v: JoinedVibe }) {
    return (
      <div className={CARD}>
        <Link href={`/vibes/${v.id}`} className="flex items-center gap-3">
          <Thumb photo={v.photos?.[0]} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-extrabold">{v.title}</p>
            <p className="truncate text-xs font-medium text-muted">
              {formatVibeWhen(v.starts_at, locale, v.timezone)} · {v.area || v.city}
            </p>
          </div>
        </Link>
        <Stepper status={interestStatus[v.id] ?? "interested"} />
      </div>
    );
  }

  // Small faded card for the Past grid.
  function PastRow({
    href,
    photo,
    title,
    meta,
    label,
    tone = "green",
  }: {
    href: string;
    photo?: string | null;
    title: string;
    meta: string;
    label: string;
    tone?: "green" | "ink";
  }) {
    return (
      <Link href={href} className={`${CARD} flex items-center gap-3 opacity-60`}>
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-cream">
          {photo ? (
            <Image src={photo} alt="" fill sizes="36px" className="object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-base">🎟️</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold">{title}</p>
          <p className="truncate text-xs font-medium text-muted">{meta}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold text-white ${
            tone === "ink" ? "bg-ink" : "bg-[#06D6A0]"
          }`}
        >
          {label}
        </span>
      </Link>
    );
  }

  return (
    <main className="px-5 pb-10 pt-6">
      <PageTabs tabs={VIBE_TABS} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">{t("title")}</h1>
        <Link
          href="/vibes/new"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/15 bg-flockie-orange px-3 py-1.5 text-xs font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] sm:px-4 sm:py-2 sm:text-sm"
        >
          <Plus size={15} /> {t("create")}
        </Link>
      </div>
      <p className="mt-1 text-sm font-medium text-muted">{t("subtitle")}</p>

      {/* Hosting */}
      <SectionLabel>{t("hosting")}</SectionLabel>
      <div className="space-y-3">
        {activeList.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-ink/30 py-12 text-center font-medium text-muted">
            {t("emptyHosting")}
          </div>
        ) : (
          pageList.map((v) => <HostingCard key={v.id} v={v} />)
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} hrefFor={(p) => qs({ page: p, ppage })} />

      {/* You're going + In the running (side by side on desktop) */}
      {(going.length > 0 || running.length > 0) && (
        <div className={twoCol ? "grid gap-x-6 lg:grid-cols-2" : ""}>
          {going.length > 0 && (
            <section>
              <SectionLabel>{t("youreGoing")}</SectionLabel>
              <div className="space-y-3">
                {going.map((v) => (
                  <GoingCard key={v.id} v={v} />
                ))}
              </div>
            </section>
          )}
          {running.length > 0 && (
            <section>
              <SectionLabel>{t("inTheRunning")}</SectionLabel>
              <div className="space-y-3">
                {running.map((v) => (
                  <RunningCard key={v.id} v={v} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Past */}
      {hasPast && (
        <>
          <SectionLabel>{t("pastVibes")}</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            {attendedPast.map((v) => (
              <PastRow
                key={v.id}
                href={`/vibes/${v.id}`}
                photo={v.photos?.[0]}
                title={v.title}
                meta={`${formatVibeWhen(v.starts_at, locale, v.timezone)} · ${v.area || v.city}`}
                label={t("went")}
              />
            ))}
            {pastPageList.map((v) => (
              <PastRow
                key={v.id}
                href={`/vibes/${v.id}`}
                photo={v.photos?.[0]}
                title={v.title}
                meta={`${formatVibeWhen(v.starts_at, locale, v.timezone)} · ${v.location_name || v.city}`}
                label={v.status === "cancelled" ? t("status.cancelled") : t("status.completed")}
                tone={v.status === "cancelled" ? "ink" : "green"}
              />
            ))}
          </div>
          {pastList.length > 0 && (
            <Pagination page={ppage} totalPages={pastTotalPages} hrefFor={(p) => qs({ page, ppage: p })} />
          )}
        </>
      )}
    </main>
  );
}
