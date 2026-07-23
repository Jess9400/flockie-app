import Link from "next/link";
import { CalendarDays, ChevronLeft, CircleDot, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import FounderInvitePanel, { type FounderInvite } from "@/components/FounderInvitePanel";
import ClubHeartbeatControls from "@/components/ClubHeartbeatControls";
import ClubInviteAccept from "@/components/ClubInviteAccept";
import ClubModeToggle from "@/components/ClubModeToggle";
import ClubMembershipRequest from "@/components/ClubMembershipRequest";
import ClubMembershipRequests from "@/components/ClubMembershipRequests";

type ClubDetail = {
  id: string;
  title: string;
  description: string | null;
  city: string;
  area: string | null;
  category: string | null;
  cadence: "weekly" | "biweekly" | "monthly";
  status: "forming" | "active" | "paused" | "closed";
  is_host: boolean;
  membership_status: string | null;
  has_attended: boolean;
  next_vibe_id: string | null;
  next_vibe_title: string | null;
  next_vibe_starts_at: string | null;
  last_completed_vibe_id: string | null;
  last_completed_vibe_title: string | null;
};

export default async function ClubPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const t = await getTranslations("clubs.detail");
  const { data } = await supabase.rpc("club_detail", { p_club: params.id }).maybeSingle();
  // Host-only extra: the operating mode drives the heartbeat (RLS limits this
  // read to the owner; non-hosts just get null).
  const { data: modeRow } = await supabase
    .from("clubs")
    .select("operating_mode")
    .eq("id", params.id)
    .maybeSingle();
  const operatingMode = modeRow?.operating_mode ?? null;
  const club = data as ClubDetail | null;

  if (!club) {
    return (
      <main className="mx-auto max-w-2xl px-5 pb-10 pt-12 text-center">
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

  const statusKey = club.status as "forming" | "active" | "paused" | "closed";
  const cadenceKey = `cadence${club.cadence[0].toUpperCase()}${club.cadence.slice(1)}` as
    | "cadenceWeekly"
    | "cadenceBiweekly"
    | "cadenceMonthly";
  const when = club.next_vibe_starts_at
    ? new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(club.next_vibe_starts_at))
    : null;
  const { data: founderInvites } = club.is_host
    ? await supabase
        .from("club_founder_invites")
        .select("token, status, expires_at")
        .eq("club_id", club.id)
        .in("status", ["active", "accepted"])
        .order("created_at", { ascending: false })
    : { data: [] as FounderInvite[] };
  let membershipRequests: { id: string; display_name: string | null; photos: string[] | null }[] = [];
  if (club.is_host) {
    const { data: requestRows } = await supabase
      .from("club_memberships")
      .select("user_id")
      .eq("club_id", club.id)
      .eq("status", "requested");
    const requestIds = (requestRows ?? []).map((row) => row.user_id);
    if (requestIds.length) {
      const { data: requestProfiles } = await supabase
        .from("public_profiles")
        .select("id, display_name, photos")
        .in("id", requestIds);
      const byId = new Map((requestProfiles ?? []).map((profile) => [profile.id, profile]));
      membershipRequests = requestIds.map((id) => ({
        id,
        display_name: byId.get(id)?.display_name ?? null,
        photos: byId.get(id)?.photos ?? null,
      }));
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-5 pb-10 pt-6">
      <Link href="/vibes" className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink">
        <ChevronLeft size={16} /> {t("back")}
      </Link>

      <section className="mt-6 overflow-hidden rounded-[2rem] border border-ink/15 bg-white shadow-[0_10px_35px_rgba(10,37,69,0.08)]">
        <div className="bg-gradient-to-br from-flockie-blue via-[#80c5ea] to-[#d7eefb] p-6 sm:p-8">
          <span className="inline-flex rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold tracking-wide text-ink">
            <CircleDot className="mr-1.5 text-flockie-coral" size={14} /> {t(statusKey)}
          </span>
          <h1 className="mt-7 max-w-xl text-3xl font-black tracking-tight text-ink sm:text-4xl">{club.title}</h1>
          {club.description && <p className="mt-3 max-w-xl text-base font-semibold leading-relaxed text-ink/75">{club.description}</p>}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-ink/10 px-5 py-4 sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-sm font-bold text-ink">
            <MapPin size={15} className="text-flockie-coral" /> {club.area ? `${club.area}, ${club.city}` : t("inCity", { city: club.city })}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-sm font-bold text-ink">
            <CalendarDays size={15} className="text-flockie-coral" /> {t(cadenceKey)}
          </span>
          {club.category && <span className="rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-sm font-bold text-ink">{club.category}</span>}
        </div>
      </section>

      {club.is_host && club.status === "forming" && !club.last_completed_vibe_id && (
        <section className="mt-5 rounded-[2rem] border border-flockie-blue/30 bg-flockie-blue/10 p-5 sm:p-6">
          <div className="flex gap-3">
            <Sparkles className="mt-0.5 shrink-0 text-flockie-coral" size={23} />
            <div>
              <p className="text-lg font-black text-ink">{t("formingTitle")}</p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-muted">{t("formingBody")}</p>
            </div>
          </div>
          <Link
            href={`/vibes/new?club=${club.id}`}
            className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-flockie-coral px-5 py-3 text-sm font-extrabold text-white shadow-[0_3px_0_#d84e32] sm:w-auto"
          >
            {t("planFirst")}
          </Link>
        </section>
      )}

      {club.is_host && (club.status === "forming" || club.status === "active") && (
        <FounderInvitePanel clubId={club.id} initialInvites={(founderInvites ?? []) as FounderInvite[]} />
      )}

      {!club.is_host && club.has_attended && club.status === "active" && !["founding", "regular", "invited"].includes(club.membership_status ?? "") && (
        <ClubMembershipRequest clubId={club.id} status={club.membership_status} />
      )}

      {!club.is_host && club.membership_status === "invited" && (
        <ClubInviteAccept clubId={club.id} />
      )}

      {(club.is_host || ["founding", "regular"].includes(club.membership_status ?? "")) && (
        <Link
          href={`/clubs/${club.id}/chat`}
          className="mt-5 flex items-center justify-between rounded-[2rem] border border-ink/15 bg-white p-5 shadow-[0_8px_30px_rgba(10,37,69,0.05)] transition-transform hover:-translate-y-0.5 sm:p-6"
        >
          <div>
            <h2 className="text-lg font-black text-ink">💬 {t("clubChat")}</h2>
            <p className="mt-0.5 text-sm font-medium text-muted">{t("clubChatSub")}</p>
          </div>
          <span className="rounded-full bg-flockie-blue px-4 py-2 text-sm font-bold text-white">{t("openChat")}</span>
        </Link>
      )}

      {club.is_host && <ClubMembershipRequests clubId={club.id} requests={membershipRequests} />}

      {club.is_host && operatingMode && (
        <ClubModeToggle clubId={club.id} mode={operatingMode} />
      )}

      {club.is_host && (
        <ClubHeartbeatControls
          clubId={club.id}
          status={club.status}
          lastCompletedVibeId={club.last_completed_vibe_id}
          nextVibeId={club.next_vibe_id}
        />
      )}

      <section className="mt-5 rounded-[2rem] border border-ink/15 bg-white p-5 shadow-[0_8px_30px_rgba(10,37,69,0.05)] sm:p-6">
        <h2 className="text-lg font-black text-ink">{t("nextGathering")}</h2>
        {club.next_vibe_id && club.next_vibe_title && when ? (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-ink/15 bg-cream p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-extrabold text-ink">{club.next_vibe_title}</p>
              <p className="mt-1 text-sm font-semibold text-muted">{when}</p>
            </div>
            <Link href={`/vibes/${club.next_vibe_id}`} className="rounded-full border-2 border-ink/20 bg-white px-4 py-2 text-center text-sm font-extrabold text-ink">
              {t("viewVibe")}
            </Link>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border-2 border-dashed border-ink/15 bg-cream px-4 py-6 text-center">
            <p className="font-extrabold text-ink">{t("noGatheringTitle")}</p>
            <p className="mt-1 text-sm font-medium text-muted">{t("noGatheringBody")}</p>
          </div>
        )}
      </section>

      <section className="mt-5 flex gap-3 rounded-[2rem] border border-ink/15 bg-white p-5 sm:p-6">
        <ShieldCheck className="mt-0.5 shrink-0 text-flockie-blue" size={23} />
        <div>
          <h2 className="font-black text-ink">{t("privacyTitle")}</h2>
          <p className="mt-1 text-sm font-medium leading-relaxed text-muted">{t("privacyBody")}</p>
        </div>
      </section>
    </main>
  );
}
