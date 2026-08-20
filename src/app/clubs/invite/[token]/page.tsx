import Link from "next/link";
import { CalendarDays, ChevronRight, MapPin, Sparkles } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { formatVibeWhen } from "@/lib/vibes";
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
  next_vibe_id: string | null;
  next_vibe_title: string | null;
  next_vibe_starts_at: string | null;
  next_vibe_timezone: string | null;
};

export default async function ClubFounderInvitePage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const t = await getTranslations("clubs.invite");
  const locale = await getLocale();
  const wellFormed = /^[0-9a-fA-F-]{36}$/.test(params.token);
  // Signed-out visitors preview the club through the anon-callable RPC, the
  // way shared Vibe links work; they sign in when they accept.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = wellFormed
    ? await supabase
        .rpc(user ? "club_founder_invite_detail" : "public_club_invite", { p_token: params.token })
        .maybeSingle()
    : { data: null };
  const invite = data as FounderInviteDetail | null;

  if (!invite) {
    // Work out WHY, instead of one message covering four different situations.
    // Only a club host can read its own invite rows (RLS), so a row coming
    // back here means the viewer is the host looking at their own link - by
    // far the most common way to land on this page.
    const { data: ownRow } = wellFormed
      ? await supabase
          .from("club_founder_invites")
          .select("status, club_id, clubs(title)")
          .eq("token", params.token)
          .maybeSingle()
      : { data: null };
    const own = ownRow as { status: string; club_id: string; clubs?: { title?: string } | null } | null;

    return (
      <main className="mx-auto max-w-xl px-5 pb-10 pt-12 text-center">
        <div className="rounded-3xl border border-ink/15 bg-white p-8 shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
          <h1 className="text-2xl font-black text-ink">
            {own ? t("hostOwnTitle") : wellFormed ? t("notFoundTitle") : t("incompleteTitle")}
          </h1>
          <p className="mt-2 text-sm font-medium leading-relaxed text-muted">
            {own ? t("hostOwnBody") : wellFormed ? t("notFoundBody") : t("incompleteBody")}
          </p>
          {own && own.status === "paused" && (
            <p className="mt-3 rounded-2xl bg-flockie-coral/10 px-4 py-3 text-sm font-bold text-ink">
              {t("pausedNotice")}
            </p>
          )}
          <Link
            href={own ? `/clubs/${own.club_id}` : "/clubs"}
            className="mt-6 inline-flex rounded-full bg-flockie-coral px-5 py-3 text-sm font-extrabold text-white"
          >
            {own ? t("openClub") : t("explore")}
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
      <section className="overflow-hidden rounded-3xl border border-ink/15 bg-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
        <div className="bg-gradient-to-br from-flockie-blue via-[#80c5ea] to-[#d7eefb] p-6 sm:p-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold tracking-wide text-ink">
            <Sparkles size={14} className="text-flockie-coral" /> {t("eyebrow")}
          </span>
          <h1 className="mt-7 text-2xl font-black text-ink">{t("title", { club: invite.club_title })}</h1>
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
          {invite.next_vibe_starts_at && (
            <Link
              href={invite.next_vibe_id ? `/vibes/${invite.next_vibe_id}` : `/clubs/${invite.club_id}`}
              className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-flockie-coral/30 bg-cream p-4 transition hover:border-flockie-coral/60"
            >
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-flockie-coral">
                  {t("nextGathering")}
                </p>
                <p className="mt-1 text-base font-black text-ink">{invite.next_vibe_title}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-muted">
                  <CalendarDays size={15} className="text-flockie-coral" />
                  {formatVibeWhen(invite.next_vibe_starts_at, locale, invite.next_vibe_timezone ?? undefined)}
                </p>
                <p className="mt-1 text-xs font-medium text-muted">{t("nextGatheringHint")}</p>
              </div>
              <ChevronRight size={20} className="shrink-0 text-flockie-coral" />
            </Link>
          )}
          <AcceptFounderInvite
            token={params.token}
            clubId={invite.club_id}
            clubTitle={invite.club_title}
            nextVibeId={invite.next_vibe_id}
            signedIn={!!user}
          />
        </div>
      </section>
    </main>
  );
}
