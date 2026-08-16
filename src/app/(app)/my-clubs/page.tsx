import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import PageTabs from "@/components/PageTabs";

// "My Clubs" - lives beside My Vibes / My Activities / My Trips in the
// My Plans tab set. Discovery stays on /clubs; this is only what's YOURS.
export default async function MyClubsPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  const t = await getTranslations("clubs.mine");
  const tmv = await getTranslations("myVibes");
  const ta = await getTranslations("activities");

  const TABS = [
    { href: "/my-vibes", label: tmv("tabMyVibes") },
    { href: "/my-clubs", label: tmv("tabClubs") },
    { href: "/my-activities", label: ta("tabActivities") },
    { href: "/my-trips", label: ta("tabTrips") },
  ];

  // Hosted + member clubs in one definer call; owned ids mark the Host badge.
  const [{ data: mineRows }, { data: ownedRows }] = await Promise.all([
    supabase.rpc("my_club_chats"),
    supabase.from("clubs").select("id").eq("owner_id", user!.id),
  ]);
  const ownedIds = new Set((ownedRows ?? []).map((r) => r.id));
  const clubs = ((mineRows ?? []) as { club_id: string; title: string; cover_photo: string | null }[])
    .filter((row, i, all) => all.findIndex((r) => r.club_id === row.club_id) === i);

  return (
    <main className="px-5 pb-10 pt-6">
      <PageTabs tabs={TABS} />
      <h1 className="text-2xl font-black text-ink">{t("title")}</h1>
      <p className="mt-1 text-sm font-medium text-muted">{t("subtitle")}</p>

      {clubs.length === 0 ? (
        <section className="mt-6 rounded-3xl border-2 border-dashed border-ink/20 bg-white px-6 py-12 text-center">
          <h2 className="text-lg font-black text-ink">{t("emptyTitle")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm font-medium text-muted">{t("emptyBody")}</p>
          <Link
            href="/clubs"
            className="mt-5 inline-flex items-center gap-1 rounded-full bg-flockie-coral px-5 py-3 text-sm font-extrabold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
          >
            {t("explore")} <ArrowRight size={16} />
          </Link>
        </section>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((club) => (
            <Link
              key={club.club_id}
              href={`/clubs/${club.club_id}`}
              className="group flex flex-col overflow-hidden rounded-[1.75rem] border border-ink/15 bg-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] transition-transform hover:-translate-y-0.5"
            >
              <div
                className="h-32 w-full bg-cream bg-cover bg-center"
                style={club.cover_photo ? { backgroundImage: `url(${club.cover_photo})` } : undefined}
              />
              <div className="flex items-center justify-between gap-2 p-4">
                <h2 className="truncate text-lg font-black text-ink">{club.title}</h2>
                {ownedIds.has(club.club_id) && (
                  <span className="shrink-0 rounded-full bg-flockie-blue px-2.5 py-1 text-[11px] font-extrabold text-white">
                    {t("hostBadge")}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
