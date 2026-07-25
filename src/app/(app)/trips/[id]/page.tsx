import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowLeft, MapPin, CalendarClock, Wallet, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import TripJoinButton from "@/components/TripJoinButton";
import TripAgendaPreview from "@/components/TripAgendaPreview";

type Detail = {
  id: string;
  kind: string;
  destination: string | null;
  destinations: string[] | null;
  start_date: string;
  end_date: string;
  group_size: number;
  trip_type: string[] | null;
  budget: number | null;
  pace: number | null;
  description: string | null;
  cover_photo: string | null;
  language: string | null;
  creator_id: string;
  creator_name: string | null;
  creator_age: number | null;
  creator_photo: string | null;
  creator_one_liner: string | null;
  creator_countries: number | null;
  creator_languages: string[] | null;
  going: number;
  is_host: boolean;
  my_request_status: string | null;
};
type Member = { id: string; display_name: string | null; photo: string | null; age: number | null; one_liner: string | null; is_host: boolean };

// Full page for a 1:1 trip — everything the board card can't hold: full
// description, budget/style, the roster of who's going, and (for members) the
// planning workspace. A Flock has its own page at /flocks/[tripId].
export default async function TripDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const user = await getSessionUser();
  const t = await getTranslations("trips");
  const tf = await getTranslations("flocks");

  const { data: rows } = await supabase.rpc("trip_detail", { p_trip: params.id });
  const d = (rows?.[0] ?? null) as Detail | null;
  if (!d) redirect("/flocks");
  if (d.kind === "flock") redirect(`/flocks/${params.id}`);

  const isMember = d.is_host || d.my_request_status === "accepted";
  const { data: memberRows } = isMember
    ? await supabase.rpc("trip_members", { p_trip: params.id })
    : { data: null };
  const members = (memberRows ?? []) as Member[];

  const destination = (d.destinations ?? [d.destination]).filter(Boolean).join(" · ");
  const budgetLabel =
    typeof d.budget === "number"
      ? d.budget <= 2 ? tf("budget.friendly") : d.budget === 3 ? tf("budget.mid") : tf("budget.comfort")
      : null;

  return (
    <main className="mx-auto max-w-2xl px-5 pb-16 pt-6">
      <Link href="/flocks" className="mb-2 inline-flex items-center gap-1 text-sm font-bold text-ink/55 hover:text-ink">
        <ArrowLeft size={15} /> {t("board.heading")}
      </Link>

      {d.cover_photo && (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-3xl border border-ink/12 bg-cream">
          <Image src={d.cover_photo} alt="" fill sizes="640px" className="object-cover" />
          <span className="absolute left-3 top-3 rounded-full bg-flockie-blue px-2.5 py-1 text-[11px] font-extrabold uppercase text-white">
            {t("board.kindTrip")}
          </span>
        </div>
      )}

      <h1 className="mt-4 flex items-start gap-2 text-2xl font-black leading-tight text-ink">
        <MapPin size={22} className="mt-1 shrink-0 text-flockie-orange" /> {destination}
      </h1>
      <p className="mt-1 flex items-center gap-2 text-sm font-bold text-muted">
        <CalendarClock size={15} /> {d.start_date} → {d.end_date}
        <span className="flex items-center gap-1"><Users size={14} /> {tf("detail.going", { going: d.going, capacity: d.group_size })}</span>
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {budgetLabel && (
          <span className="flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-xs font-bold text-ink/70">
            <Wallet size={12} /> {budgetLabel}
          </span>
        )}
        {d.language && <span className="rounded-full bg-cream px-2.5 py-1 text-xs font-bold text-ink/70">🗣 {d.language}</span>}
        {(d.trip_type ?? []).map((tag) => (
          <span key={tag} className="rounded-full bg-cream px-2.5 py-1 text-xs font-bold text-ink/70">{tag}</span>
        ))}
      </div>

      {d.description && (
        <p className="mt-4 whitespace-pre-line rounded-2xl border border-ink/12 bg-cream p-4 text-sm font-medium leading-relaxed text-ink">
          {d.description}
        </p>
      )}

      {/* Creator */}
      <Link href={`/people/${d.creator_id}`} className="mt-4 flex items-center gap-3 rounded-2xl border border-ink/15 bg-white p-4 shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
        {d.creator_photo ? (
          <Image src={d.creator_photo} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-flockie-blue text-lg font-bold text-white">
            {(d.creator_name ?? "?")[0]?.toUpperCase()}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-muted">{tf("detail.hostedBy")}</span>
          <span className="block truncate text-base font-extrabold text-ink">
            {d.creator_name}{d.creator_age ? `, ${d.creator_age}` : ""}
          </span>
          <span className="block truncate text-xs font-medium text-muted">
            {[
              d.creator_countries ? t("board.countriesVisited", { count: d.creator_countries }) : null,
              (d.creator_languages ?? []).slice(0, 3).join(", ") || null,
              d.creator_one_liner,
            ].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="shrink-0 text-sm font-bold text-flockie-blue">{tf("detail.view")}</span>
      </Link>

      {/* Itinerary preview — visible to browsers too */}
      <TripAgendaPreview tripId={d.id} />

      {/* Action / status */}
      <div className="mt-4">
        {d.is_host ? (
          <Link href="/my-trips" className="block rounded-2xl border border-ink/15 bg-cream p-4 text-center text-sm font-bold text-ink">
            {tf("detail.manageInMyTrips")}
          </Link>
        ) : d.my_request_status === "accepted" ? (
          <div className="rounded-2xl border border-ink/15 bg-[#06D6A0]/10 p-4 text-center font-extrabold text-ink">
            {t("board.going")}
          </div>
        ) : (
          <div className="flex justify-center">
            <TripJoinButton tripId={d.id} destination={destination} creatorName={d.creator_name ?? "?"} initialStatus={d.my_request_status} />
          </div>
        )}
      </div>

      {/* Roster — members only */}
      {isMember && members.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-extrabold uppercase tracking-wide text-ink/50">{t("detail.whosGoing")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {members.map((m) => (
              <Link key={m.id} href={`/people/${m.id}`} className="flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-2 py-1 text-xs font-bold text-ink">
                {m.photo ? (
                  <Image src={m.photo} alt="" width={20} height={20} className="h-5 w-5 rounded-full object-cover" />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-flockie-blue text-[10px] font-bold text-white">{(m.display_name ?? "?")[0]?.toUpperCase()}</span>
                )}
                {m.display_name ?? "Flockie"}
                {m.is_host && <span className="text-flockie-coral">★</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Workspace — members only */}
      
    </main>
  );
}
