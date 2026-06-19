import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin, Users, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import InterestButton from "@/components/InterestButton";
import HostVibeControls from "@/components/HostVibeControls";
import VibeReviewSummary from "@/components/VibeReviewSummary";
import { formatVibeWhen, DEALBREAKER_RULES, VIBE_REVIEW_TAGS, type InterestStatus } from "@/lib/vibes";

export default async function VibeDetailPage({
  params,
}: {
  params: { id: string };
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
    .select("onboarding_complete, activities")
    .eq("id", user!.id)
    .maybeSingle();
  const profileComplete =
    !!me?.onboarding_complete && (me?.activities ?? []).length > 0;

  const { data: myInterest } = await supabase
    .from("vibe_interests")
    .select("status, invitation_expires_at")
    .eq("vibe_id", params.id)
    .eq("user_id", user!.id)
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

  let attendees: { display_name: string | null; photos: string[] | null }[] = [];
  const attendeeIds = (confirmedRows ?? []).map((r) => r.user_id);
  if (attendeeIds.length) {
    const { data: ap } = await supabase
      .from("profiles")
      .select("display_name, photos")
      .in("id", attendeeIds);
    attendees = ap ?? [];
  }

  const isHost = host?.id === user!.id;

  // Host-only matching tally
  const tally: Record<string, number> = {};
  if (isHost) {
    const { data: rows } = await supabase
      .from("vibe_interests")
      .select("status")
      .eq("vibe_id", params.id);
    rows?.forEach((r) => {
      tally[r.status] = (tally[r.status] ?? 0) + 1;
    });
  }

  const rules = (vibe.dealbreaker_rules ?? {}) as Record<string, boolean>;
  const activeRules = DEALBREAKER_RULES.filter((r) => rules[r.key]);

  // Vibe reviews (the event) — aggregate into weighted %.
  const { data: reviewRows } = await supabase
    .from("vibe_reviews")
    .select("recommend, tags")
    .eq("vibe_id", params.id);
  const reviews = reviewRows ?? [];
  const reviewCount = reviews.length;
  const recommendPct = reviewCount
    ? Math.round((reviews.filter((r) => r.recommend).length / reviewCount) * 100)
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

  return (
    <main className="px-5 pb-10 pt-6">
      <Link
        href="/vibes"
        className="mb-3 flex w-fit items-center gap-1 text-sm font-bold text-muted"
      >
        <ChevronLeft size={16} /> Back
      </Link>

      {vibe.photos?.[0] && (
        <div className="relative h-56 w-full overflow-hidden rounded-3xl border-2 border-ink">
          <Image src={vibe.photos[0]} alt="" fill sizes="100vw" className="object-cover" />
        </div>
      )}

      {vibe.status === "cancelled" && (
        <div className="mt-4 rounded-2xl border-2 border-ink bg-cream p-3 text-sm font-bold text-muted">
          This Vibe was cancelled by the host. The chat is now inactive.
        </div>
      )}

      <span className="mt-4 inline-block rounded-full border-2 border-ink bg-white px-3 py-0.5 text-xs font-extrabold lowercase">
        {vibe.category}
      </span>
      <h1 className="mt-2 text-2xl font-black leading-tight">{vibe.title}</h1>

      <div className="mt-3 space-y-1.5 text-sm font-medium text-ink">
        <p className="flex items-center gap-2">
          <CalendarClock size={16} className="text-flockie-orange" />
          {formatVibeWhen(vibe.starts_at)}
        </p>
        <p className="flex items-center gap-2">
          <MapPin size={16} className="text-flockie-orange" />
          {vibe.location_name ? `${vibe.location_name}, ${vibe.city}` : vibe.city}
        </p>
        <p className="flex items-center gap-2">
          <Users size={16} className="text-flockie-orange" />
          {confirmedCount ?? 0}/{vibe.capacity} going
        </p>
      </div>

      <p className="mt-4 whitespace-pre-wrap text-[15px] font-medium text-ink/80">
        {vibe.description}
      </p>

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

      {/* host */}
      <div className="mt-5 flex items-center gap-3 rounded-2xl border-2 border-ink bg-white p-3">
        {host?.photos?.[0] ? (
          <Image
            src={host.photos[0]}
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-flockie-blue font-bold text-white">
            {(host?.display_name || "F")[0]}
          </span>
        )}
        <div>
          <p className="text-sm font-bold">
            Hosted by {host?.display_name || "a flockie"}
          </p>
          {host?.one_liner && (
            <p className="text-xs font-medium text-muted">{host.one_liner}</p>
          )}
        </div>
      </div>

      {/* tags + rules */}
      {((vibe.event_vibe_tags?.length ?? 0) > 0 ||
        activeRules.length > 0 ||
        (vibe.gender_pref && vibe.gender_pref !== "any")) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {vibe.event_vibe_tags?.map((t: string) => (
            <span key={t} className="rounded-full bg-cream px-3 py-1 text-xs font-bold text-ink">
              {t}
            </span>
          ))}
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

      {/* confirmed attendees */}
      {(confirmedCount ?? 0) > 0 && (
        <div className="mt-5">
          <p className="text-sm font-bold">Going</p>
          <div className="mt-2 flex -space-x-2">
            {attendees.map((a, i) =>
              a.photos?.[0] ? (
                <Image
                  key={i}
                  src={a.photos[0]}
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full border-2 border-white object-cover"
                />
              ) : (
                <span
                  key={i}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-flockie-blue text-xs font-bold text-white"
                >
                  {(a.display_name || "F")[0]}
                </span>
              )
            )}
          </div>
        </div>
      )}

      {/* Vibe reviews */}
      <VibeReviewSummary recommendPct={recommendPct} count={reviewCount} tagPcts={tagPcts} />
      {canReview && (
        <Link
          href={`/vibes/${vibe.id}/review`}
          className="mt-4 flex w-fit items-center gap-2 rounded-full border-2 border-ink bg-flockie-orange px-5 py-2.5 text-sm font-bold text-white shadow-[0_3px_0_0_#E0512C]"
        >
          ⭐ How was it? Review this Vibe
        </Link>
      )}

      {isHost && (
        <div className="mt-6 rounded-2xl border-2 border-ink bg-white p-4">
          <p className="text-sm font-extrabold">Matching results (host only)</p>
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

      <div className="mt-6">
        {isHost ? (
          <HostVibeControls
            vibeId={vibe.id}
            status={vibe.status}
            startsAt={vibe.starts_at}
            endsAt={vibe.ends_at}
            signupDeadline={vibe.signup_deadline}
          />
        ) : (
          <InterestButton
            vibeId={vibe.id}
            userId={user!.id}
            profileComplete={profileComplete}
            initialStatus={(myInterest?.status as InterestStatus) ?? null}
            invitationExpiresAt={myInterest?.invitation_expires_at ?? null}
            cancelled={vibe.status === "cancelled"}
          />
        )}
      </div>
    </main>
  );
}
