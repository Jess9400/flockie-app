import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil, MapPin, CalendarClock, MessageCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import DeleteTripButton from "@/components/DeleteTripButton";
import PageTabs from "@/components/PageTabs";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 5;

type ActivityRow = {
  id: string;
  title: string | null;
  destination: string | null;
  destinations: string[] | null;
  start_date: string;
  end_date: string;
  trip_type: string[] | null;
  status: string;
  cover_photo: string | null;
};

export default async function MyActivitiesPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const supabase = await createClient();
  const user = await getSessionUser();
  const t = await getTranslations("activities");

  const TRIP_TABS = [
    { href: "/my-activities", label: t("tabActivities") },
    { href: "/deals", label: t("tabDeals") },
    { href: "/my-trips", label: t("tabTrips") },
  ];

  const { data: activities } = await supabase
    .from("trips")
    .select("id, title, destination, destinations, start_date, end_date, trip_type, status, created_at, cover_photo")
    .eq("user_id", user!.id)
    .eq("kind", "activity")
    .order("created_at", { ascending: false });

  const all = (activities ?? []) as ActivityRow[];

  // Activities I JOINED (via the board "I'm in"): my liked swipes carrying an
  // activity plan stash. Matched ones link to the chat; the rest are pending.
  const { data: joinedSwipes } = await supabase
    .from("buddy_swipes")
    .select("target_id, plan_place_name, created_at")
    .eq("swiper_id", user!.id)
    .eq("liked", true)
    .eq("plan_category", "activity")
    .order("created_at", { ascending: false })
    .limit(10);
  type Joined = { title: string; partnerId: string; partnerName: string; partnerPhoto: string | null; chatId: string | null };
  let joined: Joined[] = [];
  const targetIds = Array.from(new Set((joinedSwipes ?? []).map((r) => r.target_id as string)));
  if (targetIds.length) {
    const inList = `(${targetIds.join(",")})`;
    const [{ data: jm }, { data: jp }] = await Promise.all([
      supabase
        .from("buddy_matches")
        .select("id, user_a, user_b")
        .or(`and(user_a.eq.${user!.id},user_b.in.${inList}),and(user_b.eq.${user!.id},user_a.in.${inList})`),
      supabase.from("public_profiles").select("id, display_name, photos").in("id", targetIds),
    ]);
    const matchByPartner: Record<string, string> = {};
    (jm ?? []).forEach((m) => {
      const partner = m.user_a === user!.id ? m.user_b : m.user_a;
      matchByPartner[partner] = m.id;
    });
    const matchIds = Object.values(matchByPartner);
    const { data: jchats } = matchIds.length
      ? await supabase.from("buddy_chats").select("id, match_id").in("match_id", matchIds)
      : { data: null };
    const chatByMatch: Record<string, string> = {};
    (jchats ?? []).forEach((c) => (chatByMatch[c.match_id] = c.id));
    const profById: Record<string, { display_name: string | null; photos: string[] | null }> = {};
    (jp ?? []).forEach((pr) => (profById[pr.id] = pr));
    joined = (joinedSwipes ?? []).map((r) => {
      const partner = r.target_id as string;
      const m = matchByPartner[partner];
      return {
        title: (r.plan_place_name as string | null) || "",
        partnerId: partner,
        partnerName: profById[partner]?.display_name ?? "Flockie",
        partnerPhoto: profById[partner]?.photos?.[0] ?? null,
        chatId: m ? chatByMatch[m] ?? null : null,
      };
    });
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  const isPast = (a: ActivityRow) =>
    a.status === "completed" || a.status === "cancelled" || (!!a.end_date && a.end_date < todayStr);
  const activeList = all.filter((a) => !isPast(a));
  const pastList = all.filter(isPast);

  const page = Math.max(1, Number(searchParams.page) || 1);
  const totalPages = Math.max(1, Math.ceil(activeList.length / PAGE_SIZE));
  const pageList = activeList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function ActivityCard({ row, faded }: { row: ActivityRow; faded?: boolean }) {
    return (
      <div
        className={`rounded-2xl border border-ink/15 bg-white p-4 shadow-[0_2px_10px_rgba(10,37,69,0.08)] ${faded ? "opacity-60" : ""}`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            {row.cover_photo && (
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-ink/15 bg-cream">
                <Image src={row.cover_photo} alt="" fill sizes="64px" className="object-cover" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-ink/15 bg-flockie-blue px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">
                  {t("badge")}
                </span>
                {faded ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                      row.status === "cancelled" ? "bg-ink text-white" : "bg-[#06D6A0] text-white"
                    }`}
                  >
                    {row.status === "cancelled" ? t("statusCancelled") : t("statusCompleted")}
                  </span>
                ) : (
                  row.status !== "active" && (
                    <span className="text-[10px] font-bold uppercase text-muted">{row.status}</span>
                  )
                )}
              </div>
              <p className="mt-1 flex items-center gap-1.5 font-extrabold">
                <MapPin size={15} className="shrink-0 text-flockie-orange" />{" "}
                <span className="min-w-0 break-words">
                  {row.title || (row.destinations ?? [row.destination]).filter(Boolean).join(" · ")}
                </span>
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-muted">
                <CalendarClock size={13} className="shrink-0" /> {row.start_date} → {row.end_date}
              </p>
              {(row.trip_type?.length ?? 0) > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {row.trip_type!.map((tag) => (
                    <span key={tag} className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-bold">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 sm:ml-auto">
            {!faded && (
              <Link
                href={`/match/trip?id=${row.id}`}
                className="flex shrink-0 items-center gap-1 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-sm font-bold"
              >
                <Pencil size={14} /> {t("edit")}
              </Link>
            )}
            <DeleteTripButton tripId={row.id} label={row.title ? `"${row.title}"` : t("deleteLabel")} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="px-5 pb-10 pt-6">
      <PageTabs tabs={TRIP_TABS} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">{t("heading")}</h1>
        <Link
          href="/match/trip?kind=activity"
          className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-flockie-orange px-4 py-2 text-sm font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
        >
          <Plus size={16} /> {t("new")}
        </Link>
      </div>
      <p className="mt-1 text-sm font-medium text-muted">
        {t("subtitle")}
      </p>

      <div className="mt-6 space-y-3">
        {activeList.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-ink/30 py-12 text-center font-medium text-muted">
            {t("emptyActive")}
          </div>
        ) : (
          pageList.map((row) => <ActivityCard key={row.id} row={row} />)
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} hrefFor={(p) => (p > 1 ? `/my-activities?page=${p}` : "/my-activities")} />

      {joined.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-extrabold">{t("joined.heading")}</h2>
          <div className="mt-3 space-y-3">
            {joined.map((j, i) => (
              <div
                key={`${j.partnerId}-${i}`}
                className="flex items-center gap-3 rounded-2xl border border-ink/15 bg-white p-4 shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
              >
                {j.partnerPhoto ? (
                  <Image src={j.partnerPhoto} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-flockie-blue text-sm font-bold text-white">
                    {j.partnerName[0]?.toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold">{j.title || t("joined.fallbackTitle")}</p>
                  <p className="truncate text-xs font-medium text-muted">
                    {j.chatId ? t("joined.with", { name: j.partnerName }) : t("joined.waiting", { name: j.partnerName })}
                  </p>
                </div>
                {j.chatId ? (
                  <Link
                    href={`/buddies/${j.chatId}`}
                    className="flex shrink-0 items-center gap-1 rounded-full border border-ink/15 bg-onboarding-green px-3 py-1.5 text-sm font-bold text-white"
                  >
                    <MessageCircle size={14} /> {t("joined.openChat")}
                  </Link>
                ) : (
                  <span className="shrink-0 rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-ink/60">
                    {t("joined.pending")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {pastList.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-extrabold text-muted">{t("pastHeading")}</h2>
          <div className="mt-3 space-y-3">
            {pastList.map((row) => (
              <ActivityCard key={row.id} row={row} faded />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
