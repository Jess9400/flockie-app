import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin, Users, CalendarClock, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
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

export default async function VibeDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { interested?: string; request?: string; code?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: vibe } = await supabase
    .from("vibes")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!vibe) notFound();

  // host (plain query, no embed)
  const { data: host } = await supabase
    .from("profiles")
    .select("id, display_name, photos, one_liner")
    .eq("id", vibe.host_id)
    .maybeSingle();

  const { data: me } = await supabase
    .from("profiles")
    .select("onboarding_complete, activities, vibe_completed_at")
    .eq("id", user!.id)
    .maybeSingle();
  // For Vibe interest we only need the activity vibe check (not full onboarding).
  const activitiesDone = (me?.activities ?? []).length > 0;

  const { data: myInterest } = await supabase
    .from("vibe_interests")
    .select("status, invitation_expires_at")
    .eq("vibe_id", params.id)
    .eq("user_id", user!.id)
    .maybeSingle();

  const { data: myFeedback } = await supabase
    .from("vibe_feedback")
    .select("signal")
    .eq("vibe_id", params.id)
    .eq("user_id", user!.id)
    .eq("signal", "not_for_me")
    .maybeSingle();

  // confirmed attendees (avatars) + count
  const { data: confirmedRows } = await supabase
    .from("vibe_interests")
    .select("user_id")
    .eq("vibe_id", params.id)
    .eq("status", "confirmed")
    .limit(8);

  const { count: confirmedCount } = await supabase
    .from("vibe_interests")
    .select("id", { count: "exact", head: true })
    .eq("vibe_id", params.id)
    .eq("status", "confirmed");

  let attendees: { id: string; display_name: string | null; photos: string[] | null }[] = [];
  const attendeeIds = (confirmedRows ?? []).map((r) => r.user_id);
  if (attendeeIds.length) {
    const { data: ap } = await supabase
      .from("profiles")
      .select("id, display_name, photos")
      .in("id", attendeeIds);
    attendees = ap ?? [];
  }

  const isHost = host?.id === user!.id;
  const eventStarted = new Date(vibe.starts_at) <= new Date();

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
  const previewRejectsUsed = vibe.preview_rejects_used ?? 0;
  // Private-link direct invites (v2): the host's reserved spots.
  const hostAlgoBase = Math.max(1, Math.ceil((vibe.capacity * (vibe.algo_share ?? 100)) / 100));
  const hostSpots = Math.max(0, vibe.capacity - hostAlgoBase);
  let privateRequests: { id: string; name: string | null; photo: string | null }[] = [];
  let hostFilled = 0;
  if (isHost) {
    const { data: rows } = await supabase
      .from("vibe_interests")
      .select("status")
      .eq("vibe_id", params.id);
    rows?.forEach((r) => {
      tally[r.status] = (tally[r.status] ?? 0) + 1;
    });

    if (vibe.status === "reviewing") {
      const { data: slRows } = await supabase
        .from("vibe_interests")
        .select("user_id, match_score")
        .eq("vibe_id", params.id)
        .eq("status", "shortlisted")
        .order("match_score", { ascending: false, nullsFirst: false });
      const slIds = (slRows ?? []).map((r) => r.user_id);
      if (slIds.length) {
        const { data: slProfiles } = await supabase
          .from("profiles")
          .select("id, display_name, photos")
          .in("id", slIds);
        const byId = new Map((slProfiles ?? []).map((p) => [p.id, p]));
        shortlist = (slRows ?? []).map((r) => ({
          id: r.user_id,
          name: byId.get(r.user_id)?.display_name ?? null,
          photo: byId.get(r.user_id)?.photos?.[0] ?? null,
          score: r.match_score ?? null,
        }));
      }
    }

    if (hostSpots > 0) {
      const { data: prRows } = await supabase
        .from("vibe_interests")
        .select("user_id, status")
        .eq("vibe_id", params.id)
        .eq("source", "private");
      const reqIds = (prRows ?? []).filter((r) => r.status === "requested").map((r) => r.user_id);
      hostFilled = (prRows ?? []).filter((r) => r.status === "invited" || r.status === "confirmed").length;
      if (reqIds.length) {
        const { data: pp } = await supabase
          .from("profiles")
          .select("id, display_name, photos")
          .in("id", reqIds);
        const byId = new Map((pp ?? []).map((p) => [p.id, p]));
        privateRequests = reqIds.map((id) => ({
          id,
          name: byId.get(id)?.display_name ?? null,
          photo: byId.get(id)?.photos?.[0] ?? null,
        }));
      }
    }

    const { data: memberRows } = await supabase
      .from("vibe_interests")
      .select("user_id, status")
      .eq("vibe_id", params.id)
      .in("status", ["invited", "confirmed"]);
    const memberIds = (memberRows ?? []).map((r) => r.user_id);
    if (memberIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, photos")
        .in("id", memberIds);
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

    const { count } = await supabase
      .from("vibe_removals")
      .select("id", { count: "exact", head: true })
      .eq("vibe_id", params.id)
      .eq("is_safety", false);
    normalRemovalCount = count ?? 0;
  }

  const rules = (vibe.dealbreaker_rules ?? {}) as Record<string, boolean>;
  const activeRules = DEALBREAKER_RULES.filter((r) => rules[r.key]);

  // Vibe reviews (the event) — aggregate into weighted %.
  const { data: reviewRows } = await supabase
    .from("vibe_reviews")
    .select("recommend, rating, tags")
    .eq("vibe_id", params.id);
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
        <ChevronLeft size={16} /> Back
      </Link>

      {vibe.status === "cancelled" && (
        <div className="mt-4 rounded-2xl border-2 border-ink bg-cream p-3 text-sm font-bold text-muted">
          This Vibe was cancelled by the host. The chat is now inactive.
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="inline-block rounded-full border-2 border-ink bg-white px-3 py-0.5 text-xs font-extrabold lowercase">
          {vibe.category}
        </span>
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

      {/* Square cover on the left, info on the right — never cropped. */}
      <div className="mt-3 flex gap-4">
        {vibe.photos?.[0] && (
          <div className="relative aspect-square w-1/2 max-w-sm shrink-0 self-start overflow-hidden rounded-2xl border-2 border-ink bg-cream">
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
              {formatVibeWhen(vibe.starts_at)}
            </p>
            <p className="flex items-center gap-2">
              <MapPin size={15} className="shrink-0 text-flockie-orange" />
              {vibe.location_name ? `${vibe.location_name}, ${vibe.city}` : vibe.city}
            </p>
            <p className="flex items-center gap-2">
              <Users size={15} className="shrink-0 text-flockie-orange" />
              {confirmedCount ?? 0}/{vibe.capacity} going
            </p>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-[15px] font-medium text-ink/80">
            {vibe.description}
          </p>
        </div>
      </div>

      {vibe.activity_url && (
        <a
          href={vibe.activity_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex w-fit items-center gap-2 rounded-full border-2 border-ink bg-flockie-blue px-4 py-2 text-sm font-bold text-white"
        >
          🎟️ View activity ↗
        </a>
      )}

      {vibe.what_to_bring && (
        <div className="mt-4 rounded-2xl border-2 border-ink bg-cream p-3">
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">What to bring / cost</p>
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
          <span className="text-xs font-bold">Hosted by {host.display_name || "a flockie"}</span>
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
          {vibe.event_vibe_tags?.map((t: string) => (
            <span key={t} className="rounded-full bg-cream px-3 py-1 text-xs font-bold text-ink">
              {t}
            </span>
          ))}
          {vibe.language && (
            <span className="rounded-full border-2 border-ink px-3 py-1 text-xs font-bold">
              🗣️ {vibe.language}
            </span>
          )}
          {((vibe.age_min != null && vibe.age_min > 18) || (vibe.age_max != null && vibe.age_max < 99)) && (
            <span className="rounded-full border-2 border-ink px-3 py-1 text-xs font-bold">
              Ages {vibe.age_min ?? 18}–{vibe.age_max ?? 99}
            </span>
          )}
          {activeRules.map((r) => (
            <span key={r.key} className="rounded-full border-2 border-ink px-3 py-1 text-xs font-bold">
              {r.label}
            </span>
          ))}
          {vibe.gender_pref && vibe.gender_pref !== "any" && (
            <span className="rounded-full border-2 border-ink bg-ink px-3 py-1 text-xs font-bold text-white">
              {vibe.gender_pref === "women" ? "Women only" : "Men only"}
            </span>
          )}
        </div>
      )}

      {/* confirmed attendees — tap any to view their profile */}
      {(confirmedCount ?? 0) > 0 && (
        <div className="mt-5">
          <p className="text-sm font-bold">
            Going{(confirmedCount ?? 0) > 0 ? ` · ${confirmedCount}` : ""}
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
                <span className="text-xs font-bold">{a.display_name || "Flockie"}</span>
              </Link>
            ))}
            {(confirmedCount ?? 0) > attendees.length && (
              <span className="flex items-center rounded-full bg-cream px-3 py-1 text-xs font-bold text-muted">
                +{(confirmedCount ?? 0) - attendees.length} more
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
            ({ratedReviews.length} review{ratedReviews.length > 1 ? "s" : ""})
          </span>
        </div>
      )}
      <VibeReviewSummary recommendPct={recommendPct} count={reviewCount} tagPcts={tagPcts} />
      {canReview && (
        <Link
          href={`/vibes/${vibe.id}/review`}
          className="mt-4 flex w-fit items-center gap-2 rounded-full border-2 border-ink bg-flockie-orange px-5 py-2.5 text-sm font-bold text-white shadow-[0_3px_0_0_#E0512C]"
        >
          ⭐ How was it? Review this Vibe
        </Link>
      )}

      {isHost && !ended && (
        <div className="mt-6 rounded-2xl border-2 border-ink bg-white p-4">
          <p className="text-sm font-extrabold">Matching results (host only)</p>
          <p className="mt-0.5 text-xs font-medium text-muted">
            The algorithm ranks and invites — no host approval needed.
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              { k: "interested", label: "Interested" },
              { k: "invited", label: "Invited" },
              { k: "confirmed", label: "Going" },
              { k: "standby", label: "Standby" },
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
        />
      )}

      {isHost && !ended && hostSpots > 0 && (
        <HostVibePrivateRequests
          vibeId={vibe.id}
          code={vibe.host_invite_code ?? null}
          requests={privateRequests}
          hostSpots={hostSpots}
          hostFilled={hostFilled}
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
              <RefreshCw size={18} /> Re-run Vibe
            </Link>
          ) : (
            <HostVibeControls vibeId={vibe.id} status={vibe.status} />
          )
        ) : (
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
          />
        )}
      </div>

      {!isHost && (
        <div className="mt-3 flex justify-center">
          <ShareVibeButton vibeId={vibe.id} />
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mt-8">
          <p className="text-sm font-extrabold">Vibes that match you more</p>
          <p className="mt-0.5 text-xs font-medium text-muted">
            This one filled up — here&rsquo;s what fits your vibe better.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2.5">
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
