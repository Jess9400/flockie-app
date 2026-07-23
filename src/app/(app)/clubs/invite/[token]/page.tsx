import Link from "next/link";
import { CalendarDays, MapPin, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import AcceptFounderInvite from "@/components/AcceptFounderInvite";

type FounderInviteDetail = {
  club_id: string;
  club_title: string;
  club_description: string | null;
  city: string;
  area: string | null;
  category: string | null;
  cadence: "weekly" | "biweekly" | "monthly";
  expires_at: string;
};

export default async function ClubFounderInvitePage({ params }: { params: { token: string } }) {
  const supabase = await createClient();
  const t = await getTranslations("clubs.invite");
  const { data } = await supabase.rpc("club_founder_invite_detail", { p_token: params.token }).maybeSingle();
  const invite = data as FounderInviteDetail | null;

  if (!invite) {
    return (
      <main className="mx-auto max-w-xl px-5 pb-10 pt-12 text-center">
        <div className="rounded-[2rem] border border-ink/15 bg-white p-8 shadow-[0_8px_30px_rgba(10,37,69,0.05)]">
          <h1 className="text-2xl font-black text-ink">{t("notFoundTitle")}</h1>
          <p className="mt-2 text-sm font-medium text-muted">{t("notFoundBody")}</p>
          <Link href="/vibes" className="mt-6 inline-flex rounded-full bg-flockie-coral px-5 py-3 text-sm font-extrabold text-white">
            {t("explore")}
          </Link>
        </div>
      </main>
    );
  }

  const cadenceKey = `cadence${invite.cadence[0].toUpperCase()}${invite.cadence.slice(1)}` as
    | "cadenceWeekly"
    | "cadenceBiweekly"
    | "cadenceMonthly";

  return (
    <main className="mx-auto max-w-xl px-5 pb-10 pt-10">
      <section className="overflow-hidden rounded-[2rem] border border-ink/15 bg-white shadow-[0_10px_35px_rgba(10,37,69,0.08)]">
        <div className="bg-gradient-to-br from-flockie-blue via-[#80c5ea] to-[#d7eefb] p-6 sm:p-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold tracking-wide text-ink">
            <Sparkles size={14} className="text-flockie-coral" /> {t("eyebrow")}
          </span>
          <h1 className="mt-7 text-3xl font-black tracking-tight text-ink">{t("title", { club: invite.club_title })}</h1>
          <p className="mt-3 text-base font-semibold leading-relaxed text-ink/75">{t("body")}</p>
        </div>

        <div className="p-5 sm:p-6">
          {invite.club_description && <p className="text-sm font-medium leading-relaxed text-muted">{invite.club_description}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-sm font-bold text-ink">
              <MapPin size={15} className="text-flockie-coral" /> {invite.area ? `${invite.area}, ${invite.city}` : t("location", { city: invite.city })}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-sm font-bold text-ink">
              <CalendarDays size={15} className="text-flockie-coral" /> {t(cadenceKey)}
            </span>
            {invite.category && <span className="rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-sm font-bold text-ink">{invite.category}</span>}
          </div>
          <AcceptFounderInvite token={params.token} clubId={invite.club_id} clubTitle={invite.club_title} />
        </div>
      </section>
    </main>
  );
}
