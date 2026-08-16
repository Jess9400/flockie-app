import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Plus, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";

type ClubDirectoryRow = {
  id: string;
  title: string;
  description: string | null;
  city: string;
  area: string | null;
  category: string | null;
  cadence: "weekly" | "biweekly" | "monthly";
  status: "forming" | "active" | "paused";
  next_vibe_id: string | null;
  next_vibe_title: string | null;
  next_vibe_starts_at: string | null;
};

const CARD_BACKGROUNDS = [
  "from-[#ffb768] via-[#ff9664] to-[#ff6b4a]",
  "from-[#8bd1f2] via-[#57b4e4] to-[#4da8da]",
  "from-[#d8c6a4] via-[#bda072] to-[#977553]",
  "from-[#b9d7b5] via-[#8fc48a] to-[#62a55f]",
];

export default async function ClubsPage(props: { searchParams: Promise<{ city?: string }> }) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const user = await getSessionUser();
  const t = await getTranslations("clubs.directory");
  const { data: profile } = await supabase
    .from("profiles")
    .select("home_city")
    .eq("id", user!.id)
    .maybeSingle();
  const city = searchParams.city?.trim() || profile?.home_city?.trim() || "";
  const { data } = await supabase.rpc("club_directory", { p_city: city || null, p_limit: 24 });
  const clubs = (data ?? []) as ClubDirectoryRow[];

  // Clubs I host or belong to - ALWAYS visible, regardless of the city filter
  // (a club inherits its city from the founding vibe, which can differ from
  // the host's home city, making it invisible in the directory below).
  const { data: mineRows } = await supabase.rpc("my_club_chats");
  const myClubs = ((mineRows ?? []) as { club_id: string; title: string; cover_photo: string | null }[])
    .filter((row, i, all) => all.findIndex((r) => r.club_id === row.club_id) === i);

  return (
    <main className="px-5 pb-10 pt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-ink">{t("title")}</h1>
          <p className="mt-0.5 text-xs font-extrabold uppercase tracking-[0.14em] text-flockie-coral">{t("eyebrow")}</p>
          <p className="mt-2 max-w-xl text-sm font-medium leading-relaxed text-muted">{t("intro")}</p>
        </div>
        <Link
          href="/clubs/new"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/15 bg-flockie-orange px-3 py-1.5 text-xs font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] sm:px-4 sm:py-2 sm:text-sm"
        >
          <Plus size={16} /> {t("start")}
        </Link>
      </div>

      {myClubs.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted">{t("myClubs")}</h2>
          <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
            {myClubs.map((club) => (
              <Link
                key={club.club_id}
                href={`/clubs/${club.club_id}`}
                className="flex w-44 shrink-0 flex-col overflow-hidden rounded-2xl border border-ink/15 bg-white shadow-[0_2px_10px_rgba(10,37,69,0.06)] transition-transform hover:-translate-y-0.5"
              >
                <div
                  className="h-20 w-full bg-cream bg-cover bg-center"
                  style={club.cover_photo ? { backgroundImage: `url(${club.cover_photo})` } : undefined}
                />
                <p className="truncate p-3 text-sm font-extrabold text-ink">{club.title}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <form action="/clubs" className="mt-6 flex gap-2 rounded-2xl border border-ink/15 bg-white p-2 shadow-[0_2px_10px_rgba(10,37,69,0.05)]">
        <label className="sr-only" htmlFor="club-city">{t("cityLabel")}</label>
        <div className="flex min-w-0 flex-1 items-center gap-2 px-2">
          <MapPin size={18} className="shrink-0 text-flockie-coral" />
          <input
            id="club-city"
            name="city"
            defaultValue={city}
            placeholder={t("cityPlaceholder")}
            className="min-w-0 flex-1 bg-transparent py-2 text-sm font-semibold text-ink outline-none placeholder:text-ink/35"
          />
        </div>
        <button type="submit" className="inline-flex items-center gap-1 rounded-xl bg-flockie-blue px-3 py-2 text-xs font-extrabold text-white sm:px-4 sm:text-sm">
          <Search size={16} /> {t("search")}
        </button>
      </form>

      {clubs.length === 0 ? (
        <section className="mt-6 rounded-3xl border-2 border-dashed border-ink/20 bg-white px-6 py-14 text-center">
          <h2 className="text-xl font-black text-ink">{city ? t("emptyTitle", { city }) : t("emptyEverywhere")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-relaxed text-muted">{t("emptyBody")}</p>
          <Link href="/clubs/new" className="mt-6 inline-flex rounded-full bg-flockie-coral px-5 py-3 text-sm font-extrabold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
            {t("start")}
          </Link>
        </section>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((club, index) => {
            const when = club.next_vibe_starts_at
              ? new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(club.next_vibe_starts_at))
              : null;
            const status = club.status === "active" ? t("active") : club.status === "paused" ? t("paused") : t("forming");
            return (
              <Link
                key={club.id}
                href={`/clubs/${club.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-ink/15 bg-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] transition-transform hover:-translate-y-0.5"
              >
                <div className={`bg-gradient-to-br ${CARD_BACKGROUNDS[index % CARD_BACKGROUNDS.length]} p-5`}>
                  <span className="inline-flex rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-extrabold text-ink">{status}</span>
                  <div className="mt-10 text-3xl" aria-hidden>✦</div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="text-lg font-black leading-tight text-ink">{club.title}</h2>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-muted">
                    <span className="inline-flex items-center gap-1"><MapPin size={14} className="text-flockie-coral" /> {club.area ? `${club.area}, ${club.city}` : club.city}</span>
                    <span className="inline-flex items-center gap-1"><CalendarDays size={14} className="text-flockie-coral" /> {t(club.cadence)}</span>
                  </div>
                  {club.description && <p className="mt-3 line-clamp-2 text-sm font-medium leading-relaxed text-muted">{club.description}</p>}
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-ink/10 pt-3">
                    <div className="min-w-0 text-xs font-bold text-ink">
                      {club.next_vibe_title && when ? (
                        <><p className="truncate">{t("next", { title: club.next_vibe_title })}</p><p className="mt-0.5 text-muted">{t("nextWhen", { when })}</p></>
                      ) : (
                        <p className="text-muted">{t("noNext")}</p>
                      )}
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-extrabold text-flockie-coral">{t("view")} <ArrowRight size={14} /></span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
