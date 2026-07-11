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
import VibeSettingsButton from "@/components/VibeSettingsButton";
import LeaveVibeButton from "@/components/LeaveVibeButton";
import ShareVibeButton from "@/components/ShareVibeButton";
import VibeReviewSummary from "@/components/VibeReviewSummary";
import Stars from "@/components/Stars";
import { formatVibeWhen, DEALBREAKER_RULES, VIBE_REVIEW_TAGS, type InterestStatus } from "@/lib/vibes";
import { formatApproximateVibeLocation } from "@/lib/vibe-location";

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
  // The vibe lookup only needs params.id — fetch it alongside the user.
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
          className="mt-6 inline-block rounded-full border-2 border-ink bg-flockie-orange px-5 py-2.5 font-bold text-white shadow-[0_4px_0_0_#E0512C]"
        >
          {t("detail.exploreVibes")}
        </Link>
      </main>
    );
  }
  const isHost = vibe.host_id === user!.id;
  // Full multi-select categories (falls back to the single `category` in render).
  const vibeCategories = ((vibe.categories as string[] | null) ?? []).filter(Boolean);

  // These reads only depend on the vibe row and the viewer — fetch together.
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
          .select("host_invite_code, algo_share, preview_rejects_used")
          .eq("id", params.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
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

  const eventStarted = new Date(vibe.starts_at) <= new Date();
  const approximateLocation =
    formatApproximateVibeLocation(vibe) || t("card.locationTbd");
  const locationLabel = privateLogistics?.location_name
    ? privateLogistics.location_name
    : approximateLocation;

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

  // Vibe reviews (the event) — aggregate into weighted %. (fetched above)
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
  const canReview = ended && myInterest?.status === "confirmed";

  // If the viewer didn't get in, suggest better-matched Vibes.
  let suggestions: { id: string; title: string; photos: string[] | null; match_score: number | null }[] = [];
  if (!isHost && myInterest && ["standby", "declined", "ghosted"].includes(myInterest.status)) {
    const { data: rec } = await supabase.rpc("recommended_vibes", { p_limit: 4 });
    suggestions = ((rec ?? []) as { id: string; title: string; photos: string[] | null; match_score: number | null }[])
      .filter((r) => r.id !== params.id)
      .slice(0, 3);
  }

  return (
    <main className="px-5 pb-10 pt-6">
      <Link
        href="/vibes"
        className="mb-3 flex w-fit items-center gap-1 text-sm font-bold text-muted"
      >
        <ChevronLeft size={16} /> {t("detail.back")}
      </Link>

      {vibe.status === "cancelled" && (
        <div className="mt-4 rounded-2xl border-2 border-ink bg-cream p-3 text-sm font-bold text-muted">
          {t("detail.cancelledBanner")}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {(vibeCategories.length > 0 ? vibeCategories : [vibe.category])
            .filter(Boolean)
            .map((c: string) => (
              <span
                key={c}
                className="inline-block rounded-full border-2 border-ink bg-white px-3 py-0.5 text-xs font-extrabold lowercase"
              >
                {t.has(`categories.${c}`) ? t(`categories.${c}`) : c}
              </span>
            ))}
        </div>
        {isHost ? (
          <VibeSettingsButton
            vibeId={vibe.id}
            startsAt={vibe.starts_at}
            endsAt={vibe.ends_at}
            signupDeadline={vibe.signup_deadline}
          />
        ) : (
          myInterest?.status === "confirmed" && <LeaveVibeButton vibeId={vibe.id} />
        )}
      </div>

      {/* Cover stacks above the info on phones, sits beside it at sm+. */}
      <div className="mt-3 flex flex-col gap-4 sm:flex-row">
        {vibe.photos?.[0] && (
          <div className="relative aspect-square w-full max-w-sm shrink-0 self-start overflow-hidden rounded-2xl border-2 border-ink bg-cream sm:w-1/2">
            <Image
              src={vibe.photos[0]}
              alt=""
              fill
              sizes="(max-width:640px) 50vw, 384px"
              className="object-contain"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-black leading-tight sm:text-2xl">{vibe.title}</h1>
          <div className="mt-2 space-y-1 text-sm font-medium text-ink">
            <p className="flex items-center gap-2">
              <CalendarClock size={15} className="shrink-0 text-flockie-orange" />
              {formatVibeWhen(vibe.starts_at, locale, (vibe as { timezone?: string | null }).timezone)}
            </p>
            <p className="flex items-center gap-2">
              <MapPin size={15} className="shrink-0 text-flockie-orange" />
              {locationLabel}
            </p>
            {!privateLogistics && (
              <p className="pl-[23px] text-xs font-medium text-muted">
                {t("detail.approxArea")}
              </p>
            )}
            <p className="flex items-center gap-2">
              <Users size={15} className="shrink-0 text-flockie-orange" />
              {t("detail.going", { count: confirmedCount ?? 0, capacity: vibe.capacity })}
            </p>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-[15px] font-medium text-ink/80">
            {vibe.description}
          </p>
        </div>
      </div>

      {privateLogistics?.activity_url && (
        <a
          href={privateLogistics.activity_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex w-fit items-center gap-2 rounded-full border-2 border-ink bg-flockie-blue px-4 py-2 text-sm font-bold text-white"
        >
          {t("detail.viewActivity")}
        </a>
      )}

      {vibe.what_to_bring && (
        <div className="mt-4 rounded-2xl border-2 border-ink bg-cream p-3">
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{t("detail.whatToBring")}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-ink">{vibe.what_to_bring}</p>
        </div>
      )}

      {/* host — compact tag, tap to view profile */}
      {host?.id && (
        <Link
          href={`/people/${host.id}`}
          className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-white py-1 pl-1 pr-3 transition-colors hover:bg-cream"
        >
          {host.photos?.[0] ? (
            <Image
              src={host.photos[0]}
              alt=""
              width={24}
              height={24}
              className="h-6 w-6 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-flockie-blue text-[10px] font-bold text-white">
              {(host.display_name || "F")[0]}
            </span>
          )}
          <span className="text-xs font-bold">{t("detail.hostedBy", { name: host.display_name || t("detail.hostFallback") })}</span>
        </Link>
      )}

      {/* tags + rules */}
      {((vibe.event_vibe_tags?.length ?? 0) > 0 ||
        activeRules.length > 0 ||
        vibe.language ||
        (vibe.age_min != null && vibe.age_min > 18) ||
        (vibe.age_max != null && vibe.age_max < 99) ||
        (vibe.gender_pref && vibe.gender_pref !== "any")) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {vibe.event_vibe_tags?.map((tag: string) => (
            <span key={tag} className="rounded-full bg-cream px-3 py-1 text-xs font-bold text-ink">
              {t.has(`eventTags.${tag}`) ? t(`eventTags.${tag}`) : tag}
            </span>
          ))}
          {vibe.language && (
            <span className="rounded-full border-2 border-ink px-3 py-1 text-xs font-bold">
              🗣️ {vibe.language}
            </span>
          )}
          {((vibe.age_min != null && vibe.age_min > 18) || (vibe.age_max != null && vibe.age_max < 99)) && (
            <span className="rounded-full border-2 border-ink px-3 py-1 text-xs font-bold">
              {t("detail.ages", { min: vibe.age_min ?? 18, max: vibe.age_max ?? 99 })}
            </span>
          )}
          {activeRules.map((r) => (
            <span key={r.key} className="rounded-full border-2 border-ink px-3 py-1 text-xs font-bold">
              {t.has(`rules.${r.key}`) ? t(`rules.${r.key}`) : r.label}
            </span>
          ))}
          {vibe.gender_pref && vibe.gender_pref !== "any" && (
            <span className="rounded-full border-2 border-ink bg-ink px-3 py-1 text-xs font-bold text-white">
              {vibe.gender_pref === "women" ? t("detail.womenOnly") : t("detail.menOnly")}
            </span>
          )}
        </div>
      )}

      {/* confirmed attendees — tap any to view their profile */}
      {(confirmedCount ?? 0) > 0 && (
        <div className="mt-5">
          <p className="text-sm font-bold">
            {t("detail.goingWithCount", { count: confirmedCount ?? 0 })}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {attendees.map((a) => (
              <Link
                key={a.id}
                href={`/people/${a.id}`}
                className="flex items-center gap-1.5 rounded-full border-2 border-ink bg-white py-1 pl-1 pr-3 transition-colors hover:bg-cream"
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
            {(confirmedCount ?? 0) > attendees.length && (
              <span className="flex items-center rounded-full bg-cream px-3 py-1 text-xs font-bold text-muted">
                {t("detail.moreAttendees", { count: (confirmedCount ?? 0) - attendees.length })}
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
          className="mt-4 flex w-fit items-center gap-2 rounded-full border-2 border-ink bg-flockie-orange px-5 py-2.5 text-sm font-bold text-white shadow-[0_3px_0_0_#E0512C]"
        >
          {t("detail.reviewCta")}
        </Link>
      )}

      {isHost && !ended && (
        <div className="mt-6 rounded-2xl border-2 border-ink bg-white p-4">
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

      <div className="mt-6">
        {isHost ? (
          ended ? (
            <Link
              href={`/vibes/new?from=${vibe.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-flockie-orange py-3.5 text-center font-bold text-white shadow-[0_4px_0_0_#E0512C]"
            >
              <RefreshCw size={18} /> {t("detail.reRun")}
            </Link>
          ) : (
            <HostVibeControls vibeId={vibe.id} status={vibe.status} />
          )
        ) : (
          <>
            {differentCity && !ended && vibe.status !== "cancelled" && (
              <div className="mb-2 flex items-start gap-2 rounded-2xl border-2 border-ink bg-cream p-3 text-sm font-bold text-ink">
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
              vibeFormDone={!!me?.vibe_completed_at}
              hasCity={!!me?.home_city?.trim()}
            />
          </>
        )}
      </div>

      {!isHost && (
        <div className="mt-3 flex justify-center">
          <ShareVibeButton vibeId={vibe.id} />
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
                className="flex flex-col overflow-hidden rounded-2xl border-2 border-ink bg-white shadow-[0_3px_0_0_rgba(26,26,26,1)]"
              >
                <div className="relative aspect-square w-full bg-cream">
                  {s.photos?.[0] ? (
                    <Image src={s.photos[0]} alt="" fill sizes="33vw" className="object-contain" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-2xl">🎟️</div>
                  )}
                  {typeof s.match_score === "number" && (
                    <span className="absolute right-1.5 top-1.5 rounded-full border-2 border-ink bg-flockie-coral px-1.5 py-0.5 text-[9px] font-extrabold leading-none text-white">
                      {s.match_score}%
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
