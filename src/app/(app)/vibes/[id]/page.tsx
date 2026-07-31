import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, MapPin, Users, CalendarClock, RefreshCw } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import InterestButton from "@/components/InterestButton";
import HostVibeControls from "@/components/HostVibeControls";
import HostVibeShortlist from "@/components/HostVibeShortlist";
import HostVibePrivateRequests from "@/components/HostVibePrivateRequests";
import HostVibeMembers from "@/components/HostVibeMembers";
import ClubAttendancePanel from "@/components/ClubAttendancePanel";
import VibeAttendancePanel from "@/components/VibeAttendancePanel";
import VibeSettingsButton from "@/components/VibeSettingsButton";
import LeaveVibeButton from "@/components/LeaveVibeButton";
import ShareVibeButton from "@/components/ShareVibeButton";
import VibeReviewSummary from "@/components/VibeReviewSummary";
import VibeDetailBehavior from "@/components/VibeBehaviorTracker";
import Stars from "@/components/Stars";
import {
  formatVibeWhen,
  getVibeMatchingRunAt,
  DEALBREAKER_RULES,
  VIBE_REVIEW_TAGS,
  type InterestStatus,
} from "@/lib/vibes";
import { formatApproximateVibeLocation } from "@/lib/vibe-location";
import { loadVibeMatch, type VibeDisplayMatch } from "@/lib/vibe-stats";

export default async function VibeDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { interested?: string; request?: string; code?: string };
}) {
  const supabase = await createClient();
  const t = await getTranslations("vibes");
  const locale = await getLocale();
  // The vibe lookup only needs params.id - fetch it alongside the user.
  const [user, { data: vibe }] = await Promise.all([
    getSessionUser(),
    supabase.from("vibe_directory").select("*").eq("id", params.id).maybeSingle(),
  ]);

  if (!vibe) {
    return (
      <main className="mx-auto w-full max-w-md px-5 pt-16 text-center font-nunito">
        <p className="text-4xl">🤔</p>
        <h1 className="mt-3 text-xl font-black">{t("detail.notFoundTitle")}</h1>
        <p className="mt-1 font-medium text-muted">{t("detail.notFoundBody")}</p>
        <Link
          href="/vibes"
          className="mt-6 inline-block rounded-full border border-ink/15 bg-flockie-orange px-5 py-2.5 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
        >
          {t("detail.exploreVibes")}
        </Link>
      </main>
    );
  }
  const isHost = vibe.host_id === user!.id;
  // Full multi-select categories (falls back to the single `category` in render).
  const vibeCategories = ((vibe.categories as string[] | null) ?? []).filter(Boolean);

  // These reads only depend on the vibe row and the viewer - fetch together.
  // (attendees via RPC since vibe_interests is no longer broadly readable;
  // see supabase/vibe-attendees-rls.sql)
  const [
    { data: host },
    { data: me },
    { data: myInterest },
    { data: myFeedback },
    { data: attendeeRows },
    { data: reviewRows },
    { data: hostMeta },
    vibeMatches,
  ] = await Promise.all([
    supabase
      .from("public_profiles")
      .select("id, display_name, photos, one_liner")
      .eq("id", vibe.host_id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("onboarding_complete, activities, vibe_completed_at, home_city")
      .eq("id", user!.id)
      .maybeSingle(),
    supabase
      .from("vibe_interests")
      .select("status, invitation_expires_at")
      .eq("vibe_id", params.id)
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase
      .from("vibe_feedback")
      .select("signal")
      .eq("vibe_id", params.id)
      .eq("user_id", user!.id)
      .eq("signal", "not_for_me")
      .maybeSingle(),
    supabase.rpc("vibe_attendees", { p_vibe: params.id }),
    supabase.from("vibe_reviews").select("recommend, rating, tags").eq("vibe_id", params.id),
    isHost
          ? supabase
              .from("vibes")
              .select("host_invite_code, algo_share, preview_rejects_used, club_id")
          .eq("id", params.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    isHost
      ? Promise.resolve({} as Record<string, VibeDisplayMatch>)
      : loadVibeMatch(supabase, [params.id]),
  ]);

  // For Vibe interest we only need the activity vibe check (not full onboarding).
  const activitiesDone = (me?.activities ?? []).length > 0;
  // Warn before registering for a Vibe outside the user's home city.
  const differentCity =
    !!vibe.city &&
    !!me?.home_city &&
    vibe.city.trim().toLowerCase() !== me.home_city.trim().toLowerCase();

  let privateLogistics: {
    location_name: string | null;
    location_lat: number | null;
    location_lng: number | null;
    activity_url: string | null;
  } | null = null;
  if (isHost || myInterest?.status === "confirmed") {
    const { data } = await supabase.rpc("vibe_private_logistics", { p_vibe: params.id });
    privateLogistics = data?.[0] ?? null;
  }

  const hostInviteCode: string | null = hostMeta?.host_invite_code ?? null;
  const hostAlgoShare: number = hostMeta?.algo_share ?? 100;
  const previewRejectsUsed: number = hostMeta?.preview_rejects_used ?? 0;
  const allAttendees = (attendeeRows ?? []) as {
    id: string;
    display_name: string | null;
    photos: string[] | null;
  }[];
  const confirmedCount = allAttendees.length;
  const attendees = allAttendees.slice(0, 8);
  const displayMatch = vibeMatches[vibe.id];

  const eventStarted = new Date(vibe.starts_at) <= new Date();
  const approximateLocation =
    formatApproximateVibeLocation(vibe) || t("card.locationTbd");
  const locationLabel = privateLogistics?.location_name
    ? privateLogistics.location_name
    : approximateLocation;
  // Confirmed members see the exact venue → make it a Google Maps link. Prefer
  // the precise pin (coords); fall back to the venue name + city. (No link for
  // the approximate area shown to non-members.)
  const mapHref =
    privateLogistics?.location_lat != null && privateLogistics?.location_lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${privateLogistics.location_lat},${privateLogistics.location_lng}`
      : privateLogistics?.location_name
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${privateLogistics.location_name}, ${vibe.city}`
          )}`
        : null;

  // Host-only matching tally (Interested / Invited / Going / Standby counts).
  const tally: Record<string, number> = {};
  let hostMembers: {
    id: string;
    display_name: string | null;
    photos: string[] | null;
    status: "invited" | "confirmed";
  }[] = [];
  let normalRemovalCount = 0;
  const normalRemovalLimit = Math.min(3, Math.max(1, Math.floor(vibe.capacity * 0.2)));
  // Pre-invite review (v2): the ranked shortlist the host can prune before invites.
  let shortlist: { id: string; name: string | null; photo: string | null; score: number | null }[] = [];
  const previewRejectCap = Math.max(1, Math.floor(vibe.capacity * 0.25));
  // Private-link direct invites (v2): the host's reserved spots.
  const hostAlgoBase = Math.max(1, Math.ceil((vibe.capacity * hostAlgoShare) / 100));
  const hostSpots = Math.max(0, vibe.capacity - hostAlgoBase);
  let privateRequests: { id: string; name: string | null; photo: string | null }[] = [];
  let hostFilled = 0;
  if (isHost) {
    // Stage 1: the four vibe_interests slices + removals count are independent.
    const [{ data: rows }, { data: slRows }, { data: prRows }, { data: memberRows }, { count }] =
      await Promise.all([
        supabase.from("vibe_interests").select("status").eq("vibe_id", params.id),
        vibe.status === "reviewing"
          ? supabase
              .from("vibe_interests")
              .select("user_id, match_score")
              .eq("vibe_id", params.id)
              .eq("status", "shortlisted")
              .order("match_score", { ascending: false, nullsFirst: false })
          : Promise.resolve({ data: null }),
        hostSpots > 0
          ? supabase
              .from("vibe_interests")
              .select("user_id, status")
              .eq("vibe_id", params.id)
              .eq("source", "private")
          : Promise.resolve({ data: null }),
        supabase
          .from("vibe_interests")
          .select("user_id, status")
          .eq("vibe_id", params.id)
          .in("status", ["invited", "confirmed"]),
        supabase
          .from("vibe_removals")
          .select("id", { count: "exact", head: true })
          .eq("vibe_id", params.id)
          .eq("is_safety", false),
      ]);

    rows?.forEach((r) => {
      tally[r.status] = (tally[r.status] ?? 0) + 1;
    });
    const slIds = (slRows ?? []).map((r) => r.user_id);
    const reqIds = (prRows ?? []).filter((r) => r.status === "requested").map((r) => r.user_id);
    hostFilled = (prRows ?? []).filter((r) => r.status === "invited" || r.status === "confirmed").length;
    const memberIds = (memberRows ?? []).map((r) => r.user_id);
    normalRemovalCount = count ?? 0;

    // Stage 2: the public_profiles lookups keyed by stage-1 id lists.
    const [{ data: slProfiles }, { data: pp }, { data: profiles }] = await Promise.all([
      slIds.length
        ? supabase.from("public_profiles").select("id, display_name, photos").in("id", slIds)
        : Promise.resolve({ data: null }),
      reqIds.length
        ? supabase.from("public_profiles").select("id, display_name, photos").in("id", reqIds)
        : Promise.resolve({ data: null }),
      memberIds.length
        ? supabase.from("public_profiles").select("id, display_name, photos").in("id", memberIds)
        : Promise.resolve({ data: null }),
    ]);

    if (slIds.length) {
      const byId = new Map((slProfiles ?? []).map((p) => [p.id, p]));
      shortlist = (slRows ?? []).map((r) => ({
        id: r.user_id,
        name: byId.get(r.user_id)?.display_name ?? null,
        photo: byId.get(r.user_id)?.photos?.[0] ?? null,
        score: r.match_score ?? null,
      }));
    }
    if (reqIds.length) {
      const byId = new Map((pp ?? []).map((p) => [p.id, p]));
      privateRequests = reqIds.map((id) => ({
        id,
        name: byId.get(id)?.display_name ?? null,
        photo: byId.get(id)?.photos?.[0] ?? null,
      }));
    }
    if (memberIds.length) {
      const statusByUser = new Map(
        (memberRows ?? []).map((r) => [r.user_id, r.status as "invited" | "confirmed"])
      );
      hostMembers = (profiles ?? []).map((profile) => ({
        id: profile.id,
        display_name: profile.display_name,
        photos: profile.photos,
        status: statusByUser.get(profile.id) ?? "invited",
      }));
    }
  }

  const rules = (vibe.dealbreaker_rules ?? {}) as Record<string, boolean>;
  const activeRules = DEALBREAKER_RULES.filter((r) => rules[r.key]);

  // Vibe reviews (the event) - aggregate into weighted %. (fetched above)
  const reviews = reviewRows ?? [];
  const reviewCount = reviews.length;
  const recommendPct = reviewCount
    ? Math.round((reviews.filter((r) => r.recommend).length / reviewCount) * 100)
    : 0;
  const ratedReviews = reviews.filter((r) => r.rating != null);
  const avgRating = ratedReviews.length
    ? ratedReviews.reduce((sum, r) => sum + (r.rating as number), 0) / ratedReviews.length
    : 0;
  const tagPcts = reviewCount
    ? VIBE_REVIEW_TAGS.map((tag) => ({
        tag,
        pct: Math.round(
          (reviews.filter((r) => (r.tags ?? []).includes(tag)).length / reviewCount) * 100
        ),
      }))
        .filter((t) => t.pct > 0)
        .sort((a, b) => b.pct - a.pct)
    : [];

  const ended = new Date(vibe.ends_at ?? vibe.starts_at) <= new Date();
  const clubId: string | null = hostMeta?.club_id ?? null;
  let recordedClubAttendanceIds: string[] = [];
  let recordedVibeAttendanceIds: string[] = [];
  if (isHost && ended && clubId) {
    const { data: attendanceRows } = await supabase
      .from("club_attendance")
      .select("user_id")
      .eq("club_id", clubId)
      .eq("vibe_id", vibe.id);
    recordedClubAttendanceIds = (attendanceRows ?? []).map((row) => row.user_id);
  }
  if (isHost && ended && !clubId) {
    const { data: attendanceRows } = await supabase
      .from("vibe_attendance")
      .select("user_id")
      .eq("vibe_id", vibe.id);
    recordedVibeAttendanceIds = (attendanceRows ?? []).map((row) => row.user_id);
  }
  const canReview = ended && myInterest?.status === "confirmed";
  // TEMP (2026-07-31): same-city guard removed so people from surrounding
  // cities can one-tap join; restore `!differentCity &&` to re-enable.
  const directConfirm =
    ["ranking", "finalized"].includes(vibe.status) &&
    confirmedCount < vibe.capacity &&
    new Date(vibe.starts_at) > new Date();
  const matchingRunAt = getVibeMatchingRunAt(vibe.starts_at, vibe.signup_deadline);
  const primaryCategory = vibeCategories[0] || vibe.category;
  const primaryTag = (vibe.event_vibe_tags ?? [])[0] as string | undefined;
  const showAttendeeDetails = isHost || myInterest?.status === "confirmed";

  // If the viewer didn't get in, suggest better-matched Vibes.
  let suggestions: { id: string; title: string; photos: string[] | null; match_score: number | null }[] = [];
  let suggestionMatches: Record<string, VibeDisplayMatch> = {};
  if (!isHost && myInterest && ["standby", "declined", "ghosted"].includes(myInterest.status)) {
    const { data: rec } = await supabase.rpc("recommended_vibes", { p_limit: 4 });
    suggestions = ((rec ?? []) as { id: string; title: string; photos: string[] | null; match_score: number | null }[])
      .filter((r) => r.id !== params.id)
      .slice(0, 3);
    suggestionMatches = await loadVibeMatch(supabase, suggestions.map((suggestion) => suggestion.id));
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-10 pt-6">
      {!isHost && <VibeDetailBehavior vibeId={vibe.id} />}
      <Link
        href="/vibes"
        className="mb-3 flex w-fit items-center gap-1 text-sm font-bold text-muted"
      >
        <ChevronLeft size={16} /> {t("detail.back")}
      </Link>

      {vibe.status === "cancelled" && (
        <div className="mt-4 rounded-2xl border border-ink/15 bg-cream p-3 text-sm font-bold text-muted">
          {t("detail.cancelledBanner")}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        {isHost ? (
          <VibeSettingsButton
            vibeId={vibe.id}
            startsAt={vibe.starts_at}
            endsAt={vibe.ends_at}
            signupDeadline={vibe.signup_deadline}
            capacity={vibe.capacity}
          />
        ) : (
          myInterest?.status === "confirmed" && <LeaveVibeButton vibeId={vibe.id} />
        )}
      </div>

      <section className="mt-3 overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-[0_2px_14px_rgba(10,37,69,0.07)] sm:grid sm:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-[#FFB36B] to-flockie-orange sm:aspect-auto sm:min-h-[390px]">
          {vibe.photos?.[0] ? (
            <Image
              src={vibe.photos[0]}
              alt=""
              fill
              sizes="(max-width:640px) 100vw, 50vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl">🎟️</div>
          )}
        </div>
        <div className="min-w-0 p-4 sm:p-6">
          <h1 className="font-fredoka text-2xl font-bold leading-tight sm:text-3xl">{vibe.title}</h1>
          <div className="mt-2 space-y-1 text-sm font-medium text-ink">
            <p className="flex items-center gap-2">
              <CalendarClock size={15} className="shrink-0 text-flockie-orange" />
              {formatVibeWhen(vibe.starts_at, locale, (vibe as { timezone?: string | null }).timezone)}
            </p>
            <p className="flex items-center gap-2">
              <MapPin size={15} className="shrink-0 text-flockie-orange" />
              {mapHref ? (
                <a
                  href={mapHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-flockie-orange/50 underline-offset-2 hover:text-flockie-orange"
                >
                  {locationLabel}
                </a>
              ) : (
                locationLabel
              )}
            </p>
            {!privateLogistics && (
              <p className="pl-[23px] text-xs font-medium text-muted">
                {t("detail.approxArea")}
              </p>
            )}
            <p className="flex items-center gap-2">
              <Users size={15} className="shrink-0 text-flockie-orange" />
              {t("detail.going", { count: confirmedCount, capacity: vibe.capacity })}
            </p>
          </div>
          {host?.id && (
            <Link
              href={`/people/${host.id}`}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-ink/20 bg-cream py-1 pl-1 pr-3 transition-colors hover:border-ink"
            >
              {host.photos?.[0] ? (
                <Image
                  src={host.photos[0]}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-flockie-blue text-[10px] font-bold text-white">
                  {(host.display_name || "F")[0]}
                </span>
              )}
              <span className="text-xs font-bold">
                {t("detail.hostedBy", { name: host.display_name || t("detail.hostFallback") })}
              </span>
            </Link>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {primaryCategory && (
              <span className="rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-bold text-ink">
                {t.has(`categories.${primaryCategory}`) ? t(`categories.${primaryCategory}`) : primaryCategory}
              </span>
            )}
            {primaryTag && (
              <span className="rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-bold text-ink">
                {t.has(`eventTags.${primaryTag}`) ? t(`eventTags.${primaryTag}`) : primaryTag}
              </span>
            )}
            {displayMatch?.state === "scored" && typeof displayMatch.score === "number" && (
              <span className="rounded-full bg-[#DDF2FF] px-3 py-1 text-xs font-extrabold text-flockie-blue">
                {t("card.match", { pct: displayMatch.score })}
              </span>
            )}
            {displayMatch?.state === "new_pick" && (
              <span className="rounded-full bg-cream px-3 py-1 text-xs font-extrabold text-muted">
                {t("card.newPick")}
              </span>
            )}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-[15px] font-medium text-ink/80">
            {vibe.description}
          </p>
        </div>
      </section>

      {!isHost && (
        <section className="mt-5">
          {differentCity && !ended && vibe.status !== "cancelled" && (
            <div className="mb-3 flex items-start gap-2 rounded-2xl bg-cream p-3 text-sm font-bold text-ink">
              <span className="text-base leading-none">📍</span>
              <span>
                {t.rich("detail.differentCity", {
                  city: vibe.city,
                  hl: (chunks) => <span className="text-flockie-coral">{chunks}</span>,
                })}
              </span>
            </div>
          )}
          <InterestButton
            vibeId={vibe.id}
            userId={user!.id}
            activitiesDone={activitiesDone}
            initialStatus={(myInterest?.status as InterestStatus) ?? null}
            invitationExpiresAt={myInterest?.invitation_expires_at ?? null}
            cancelled={vibe.status === "cancelled"}
            ended={ended}
            autoInterest={searchParams.interested === "1"}
            requestMode={searchParams.request === "1"}
            hostCode={searchParams.code ?? null}
            initialNotForMe={!!myFeedback}
            hasCity={!!me?.home_city?.trim()}
            directConfirm={directConfirm}
            matchingRunAt={matchingRunAt}
            matchingTimeZone={(vibe as { timezone?: string | null }).timezone}
          />
        </section>
      )}

      {vibe.what_to_bring && (
        <div className="mt-4 rounded-2xl bg-cream p-3">
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{t("detail.whatToBring")}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-ink">{vibe.what_to_bring}</p>
        </div>
      )}

      {/* Full preferences stay available without crowding the first scan. */}
      {((vibe.event_vibe_tags?.length ?? 0) > 0 ||
        activeRules.length > 0 ||
        vibe.language ||
        (vibe.age_min != null && vibe.age_min > 18) ||
        (vibe.age_max != null && vibe.age_max < 99) ||
        (vibe.gender_pref && vibe.gender_pref !== "any")) && (
        <details className="group mt-4 rounded-2xl border border-ink/10 bg-cream px-4 py-3">
          <summary className="cursor-pointer list-none text-sm font-extrabold text-ink marker:content-none">
            <span className="flex items-center justify-between gap-3">
              {t("detail.detailsAndRequirements")}
              <span className="text-lg leading-none text-muted group-open:rotate-45">+</span>
            </span>
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {vibe.event_vibe_tags?.map((tag: string) => (
              <span key={tag} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-ink">
                {t.has(`eventTags.${tag}`) ? t(`eventTags.${tag}`) : tag}
              </span>
            ))}
            {vibe.language && (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold">
                🗣️ {vibe.language}
              </span>
            )}
            {((vibe.age_min != null && vibe.age_min > 18) || (vibe.age_max != null && vibe.age_max < 99)) && (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold">
                {t("detail.ages", { min: vibe.age_min ?? 18, max: vibe.age_max ?? 99 })}
              </span>
            )}
            {activeRules.map((r) => (
              <span key={r.key} className="rounded-full bg-white px-3 py-1 text-xs font-bold">
                {t.has(`rules.${r.key}`) ? t(`rules.${r.key}`) : r.label}
              </span>
            ))}
            {vibe.gender_pref && vibe.gender_pref !== "any" && (
              <span className="rounded-full bg-ink px-3 py-1 text-xs font-bold text-white">
                {vibe.gender_pref === "women" ? t("detail.womenOnly") : t("detail.menOnly")}
              </span>
            )}
          </div>
        </details>
      )}

      {privateLogistics?.activity_url && (
        <a
          href={privateLogistics.activity_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex w-fit items-center gap-2 rounded-full border border-ink/15 bg-flockie-blue px-4 py-2 text-sm font-bold text-white"
        >
          {t("detail.viewActivity")}
        </a>
      )}

      {/* confirmed attendees - tap any to view their profile */}
      {showAttendeeDetails && confirmedCount > 0 && (
        <div className="mt-5">
          <p className="text-sm font-bold">
            {t("detail.goingWithCount", { count: confirmedCount })}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {attendees.map((a) => (
              <Link
                key={a.id}
                href={`/people/${a.id}`}
                className="flex items-center gap-1.5 rounded-full border border-ink/15 bg-white py-1 pl-1 pr-3 transition-colors hover:bg-cream"
              >
                {a.photos?.[0] ? (
                  <Image
                    src={a.photos[0]}
                    alt=""
                    width={24}
                    height={24}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-flockie-blue text-[10px] font-bold text-white">
                    {(a.display_name || "F")[0]}
                  </span>
                )}
                <span className="text-xs font-bold">{a.display_name || t("detail.attendeeFallback")}</span>
              </Link>
            ))}
            {confirmedCount > attendees.length && (
              <span className="flex items-center rounded-full bg-cream px-3 py-1 text-xs font-bold text-muted">
                {t("detail.moreAttendees", { count: confirmedCount - attendees.length })}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Vibe reviews */}
      {ratedReviews.length > 0 && (
        <div className="mt-5 flex items-center gap-2">
          <Stars value={avgRating} size={18} />
          <span className="text-sm font-bold text-ink">{avgRating.toFixed(1)}</span>
          <span className="text-sm font-medium text-muted">
            {t("detail.reviewsCount", { count: ratedReviews.length })}
          </span>
        </div>
      )}
      <VibeReviewSummary recommendPct={recommendPct} count={reviewCount} tagPcts={tagPcts} />
      {canReview && (
        <Link
          href={`/vibes/${vibe.id}/review`}
          className="mt-4 flex w-fit items-center gap-2 rounded-full border border-ink/15 bg-flockie-orange px-5 py-2.5 text-sm font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
        >
          {t("detail.reviewCta")}
        </Link>
      )}

      {!isHost && (
        <section className="mt-6 space-y-3">
          {myInterest?.status !== "confirmed" && (
            <details className="group rounded-2xl border border-ink/10 bg-cream px-4 py-3">
              <summary className="cursor-pointer list-none text-sm font-extrabold text-ink marker:content-none">
                <span className="flex items-center justify-between gap-3">
                  {t("detail.howJoiningWorks")}
                  <span className="text-lg leading-none text-muted group-open:rotate-45">+</span>
                </span>
              </summary>
              <ol className="mt-3 space-y-2 pl-5 text-sm font-medium leading-relaxed text-muted">
                <li className="list-decimal">{t("detail.joiningStep1")}</li>
                <li className="list-decimal">{t("detail.joiningStep2")}</li>
                <li className="list-decimal">{t("detail.joiningStep3")}</li>
              </ol>
            </details>
          )}
          <div className="flex justify-center">
            <ShareVibeButton vibeId={vibe.id} />
          </div>
        </section>
      )}

      {isHost && !ended && (
        <div className="mt-6 rounded-2xl border border-ink/15 bg-white p-4">
          <p className="text-sm font-extrabold">{t("detail.matchingResults")}</p>
          <p className="mt-0.5 text-xs font-medium text-muted">
            {t("detail.matchingSubtitle")}
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              { k: "interested", label: t("detail.tallyInterested") },
              { k: "invited", label: t("detail.tallyInvited") },
              { k: "confirmed", label: t("detail.tallyGoing") },
              { k: "standby", label: t("detail.tallyStandby") },
            ].map((s) => (
              <div key={s.k} className="rounded-xl bg-cream py-2">
                <p className="text-xl font-black">{tally[s.k] ?? 0}</p>
                <p className="text-[11px] font-bold text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {isHost && !ended && vibe.status === "reviewing" && (
        <HostVibeShortlist
          vibeId={vibe.id}
          candidates={shortlist}
          rejectCap={previewRejectCap}
          rejectsUsed={previewRejectsUsed}
          startsAt={vibe.starts_at}
        />
      )}

      {isHost && !ended && hostSpots > 0 && (
        <HostVibePrivateRequests
          vibeId={vibe.id}
          code={hostInviteCode}
          requests={privateRequests}
          hostSpots={hostSpots}
          hostFilled={hostFilled}
          capacity={vibe.capacity}
          filled={(tally.confirmed ?? 0) + (tally.invited ?? 0)}
        />
      )}

      {isHost && !ended && (
        <HostVibeMembers
          vibeId={vibe.id}
          members={hostMembers}
          eventStarted={eventStarted}
          normalRemovalLimit={normalRemovalLimit}
          normalRemovalUsed={normalRemovalCount}
        />
      )}

      {isHost && ended && !clubId && (
        <VibeAttendancePanel
          vibeId={vibe.id}
          attendees={allAttendees}
          recordedIds={recordedVibeAttendanceIds}
        />
      )}

      {isHost && ended && !clubId && (
        <Link
          href={`/clubs/from-vibe/${params.id}`}
          className="mt-5 flex items-center justify-between gap-3 rounded-3xl border-2 border-flockie-coral bg-white p-4 shadow-[0_2px_10px_rgba(10,37,69,0.08)] transition-transform hover:-translate-y-0.5"
        >
          <div className="min-w-0">
            <p className="text-base font-extrabold text-ink">🔁 {t("club.convertTitle")}</p>
            <p className="mt-0.5 text-sm font-medium text-muted">{t("club.convertBody")}</p>
          </div>
          <span className="shrink-0 rounded-full border-2 border-ink bg-flockie-coral px-4 py-2 text-sm font-bold text-white shadow-[0_2px_0_0_#E0512C]">
            {t("club.convertCta")}
          </span>
        </Link>
      )}

      {isHost && ended && clubId && (
        <ClubAttendancePanel
          clubId={clubId}
          vibeId={vibe.id}
          attendees={allAttendees}
          recordedIds={recordedClubAttendanceIds}
        />
      )}

      {isHost && (
        <div className="mt-6">
          {ended ? (
            <Link
              href={`/vibes/new?from=${vibe.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-flockie-orange py-3.5 text-center font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
            >
              <RefreshCw size={18} /> {t("detail.reRun")}
            </Link>
          ) : (
            <HostVibeControls vibeId={vibe.id} status={vibe.status} />
          )}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mt-8">
          <p className="text-sm font-extrabold">{t("detail.suggestionsHeading")}</p>
          <p className="mt-0.5 text-xs font-medium text-muted">
            {t("detail.suggestionsSubtitle")}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {suggestions.map((s) => (
              <Link
                key={s.id}
                href={`/vibes/${s.id}`}
                className="flex flex-col overflow-hidden rounded-2xl border border-ink/15 bg-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
              >
                <div className="relative aspect-square w-full bg-cream">
                  {s.photos?.[0] ? (
                    <Image src={s.photos[0]} alt="" fill sizes="33vw" className="object-contain" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-2xl">🎟️</div>
                  )}
                  {suggestionMatches[s.id]?.state === "scored" && typeof suggestionMatches[s.id]?.score === "number" && (
                    <span className="absolute right-1.5 top-1.5 rounded-full border border-ink/15 bg-flockie-coral px-1.5 py-0.5 text-[9px] font-extrabold leading-none text-white">
                      {suggestionMatches[s.id].score}%
                    </span>
                  )}
                  {suggestionMatches[s.id]?.state === "new_pick" && (
                    <span className="absolute right-1.5 top-1.5 rounded-full border border-ink/15 bg-cream px-1.5 py-0.5 text-[9px] font-extrabold leading-none text-muted">
                      {t("card.newPick")}
                    </span>
                  )}
                </div>
                <p className="line-clamp-2 p-2 text-[12px] font-extrabold leading-tight text-ink">{s.title}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
