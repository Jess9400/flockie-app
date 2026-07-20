import Link from "next/link";
import Image from "next/image";
import { Plus, ArrowLeft } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import { dfLocale } from "@/lib/date-locale";
import JoinActivityButton from "@/components/JoinActivityButton";

type FeedRow = {
  activity_id: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  city: string | null;
  creator_id: string;
  display_name: string | null;
  age: number | null;
  photo: string | null;
  one_liner: string | null;
  score: number | null;
};

// The Activity Board: browse 1:1 activities other people posted in your city
// and join one — no need to create your own first.
export default async function ActivitiesBoardPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  const t = await getTranslations("match.board");
  const locale = await getLocale();

  const [{ data: profile }, { data: feed, error: feedErr }] = await Promise.all([
    supabase.from("profiles").select("home_city").eq("id", user!.id).maybeSingle(),
    supabase.rpc("activity_feed", { p_limit: 30 }),
  ]);
  // Migration-safe: before activity-board.sql runs on prod the RPC is missing —
  // render the empty state instead of erroring.
  const rows: FeedRow[] = feedErr ? [] : ((feed ?? []) as FeedRow[]);
  const city = profile?.home_city ?? "";

  const fmtDates = (a: string | null, b: string | null) => {
    if (!a) return null;
    const f = (d: string) => format(new Date(d), "MMM d", { locale: dfLocale(locale) });
    return b && b !== a ? `${f(a)} – ${f(b)}` : f(a);
  };

  return (
    <main className="px-5 pb-10 pt-6">
      <Link
        href="/match"
        className="inline-flex items-center gap-1 text-sm font-bold text-ink/55 hover:text-ink"
      >
        <ArrowLeft size={15} /> {t("backToFind")}
      </Link>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">{t("heading")}</h1>
          <p className="mt-1 text-sm font-medium text-muted">
            {city ? t("subtitleCity", { city }) : t("subtitle")}
          </p>
        </div>
        <Link
          href="/match/trip?kind=activity"
          className="flex shrink-0 items-center gap-1 rounded-2xl border border-ink/15 bg-flockie-orange px-4 py-2.5 text-sm font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
        >
          <Plus size={16} /> {t("postYours")}
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-3xl border-2 border-dashed border-ink/30 bg-white p-8 text-center">
          <p className="text-3xl">🗺️</p>
          <p className="mt-3 text-lg font-extrabold">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm font-medium leading-relaxed text-muted">
            {city ? t("emptyBodyCity", { city }) : t("emptyBody")}
          </p>
          <Link
            href="/match/trip?kind=activity"
            className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-flockie-orange px-5 py-2.5 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
          >
            <Plus size={16} /> {t("emptyCta")}
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <div
              key={r.activity_id}
              className="flex flex-col rounded-3xl border border-ink/15 bg-white p-4 shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
            >
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-flockie-blue">
                {[fmtDates(r.start_date, r.end_date), r.city].filter(Boolean).join(" · ")}
              </p>
              <h2 className="mt-1 text-base font-extrabold leading-snug text-ink">
                {r.title || t("untitled")}
              </h2>
              {r.one_liner && (
                <p className="mt-1 line-clamp-2 text-xs font-medium text-muted">{r.one_liner}</p>
              )}

              <div className="mt-3 flex items-center gap-2 border-t border-ink/10 pt-3">
                <Link href={`/people/${r.creator_id}`} className="flex min-w-0 flex-1 items-center gap-2">
                  {r.photo ? (
                    <Image
                      src={r.photo}
                      alt=""
                      width={28}
                      height={28}
                      className="h-7 w-7 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-flockie-blue text-xs font-bold text-white">
                      {(r.display_name ?? "?")[0]?.toUpperCase()}
                    </span>
                  )}
                  <span className="truncate text-xs font-bold text-ink/70">
                    {r.display_name}
                    {r.age ? `, ${r.age}` : ""}
                  </span>
                  {r.score != null && (
                    <span className="shrink-0 rounded-full bg-flockie-blue/10 px-2 py-0.5 text-[10px] font-extrabold text-flockie-blue">
                      {Math.round(r.score)}%
                    </span>
                  )}
                </Link>
                <JoinActivityButton
                  activityId={r.activity_id}
                  title={r.title || t("untitled")}
                  creatorName={r.display_name ?? "?"}
                  compact
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
