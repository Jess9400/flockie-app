"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  ArrowRight,
  Check,
  Eye,
  LockKeyhole,
  RefreshCw,
  Settings,
  Share2,
} from "lucide-react";
import ActivityVibeForm from "@/components/ActivityVibeForm";
import ProfileIdentityCard from "@/components/ProfileIdentityCard";
import type { EventsData } from "@/components/ProfileEvents";
import type { ReviewItem } from "@/components/ProfileReviews";
import TripVibeForm from "@/components/TripVibeForm";
import { restartVibeCheck } from "@/lib/onboarding/vibe-actions";
import type { VibeScores } from "@/lib/onboarding/types";
import { formatVibeWhen } from "@/lib/vibes";
import type { Profile } from "@/lib/vibe-check";

type DashboardProfile = Partial<Profile> & {
  archetype?: string | null;
  vibe_scores?: VibeScores | null;
  trip_prefs_complete?: boolean | null;
  activity_prefs_complete?: boolean | null;
};

type SetupKey = "trip" | "activity" | null;

export default function OwnerProfileDashboard({
  userId,
  profile,
  reviewCount,
  reviewItems,
  stats,
  events,
  onEditProfile,
  onShare,
}: {
  userId: string;
  profile: DashboardProfile;
  reviewCount: number;
  reviewItems: ReviewItem[];
  stats?: Record<string, number>;
  events?: EventsData;
  onEditProfile: () => void;
  onShare: () => void;
}) {
  const router = useRouter();
  const [openSetup, setOpenSetup] = useState<SetupKey>(null);
  const [redoing, setRedoing] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const vibeComplete = !!(profile.archetype && profile.vibe_scores);
  const tripComplete = !!profile.trip_prefs_complete || profile.planning != null;
  const activityComplete =
    !!profile.activity_prefs_complete || (profile.activities?.length ?? 0) > 0;
  const upcoming = useMemo(() => buildUpcoming(events), [events]);
  const visibleReviews = showAllReviews ? reviewItems : reviewItems.slice(0, 2);

  function setupDone() {
    setOpenSetup(null);
    router.refresh();
  }

  async function redoQuiz() {
    if (!window.confirm("Retake your vibe quiz? Your future matching signals will update.")) {
      return;
    }
    setRedoing(true);
    try {
      await restartVibeCheck();
      router.push("/onboarding/vibe-check?returnTo=%2Fprofile");
    } catch {
      setRedoing(false);
    }
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(300px,390px)_minmax(0,1fr)] lg:items-start">
        <div className="lg:sticky lg:top-6">
          <ProfileIdentityCard
            profile={profile}
            reviewCount={reviewCount}
            stats={stats}
            onEdit={onEditProfile}
            onShare={onShare}
          />
        </div>

        <div className="min-w-0 space-y-4">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-fredoka text-3xl font-bold leading-none text-navy">
                Profile dashboard
              </h2>
              <p className="mt-1.5 text-sm font-medium text-muted">
                Manage what people see and what Flockie uses for matching.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/people/${userId}`}
                className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3 py-2 text-xs font-extrabold text-navy shadow-[0_3px_0_0_#10233d]"
              >
                <Eye size={14} /> Public profile
              </Link>
              <button
                type="button"
                onClick={onShare}
                className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3 py-2 text-xs font-extrabold text-navy shadow-[0_3px_0_0_#10233d]"
              >
                <Share2 size={14} /> Share
              </button>
              <Link
                href="/settings"
                className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3 py-2 text-xs font-extrabold text-navy shadow-[0_3px_0_0_#10233d]"
              >
                <Settings size={14} /> Settings
              </Link>
            </div>
          </header>

          <Panel
            title="Match setup"
            description="Private inputs used by Flockie. Other users never see your raw preferences or dealbreakers."
            badge={
              <span className="rounded-full bg-flockie-coral/15 px-2.5 py-1 text-[10px] font-extrabold text-flockie-coral">
                Private
              </span>
            }
          >
            <div className="space-y-2.5">
              <SetupCard
                emoji="🧬"
                title="Vibe quiz"
                description="Your global personality read across buddies, trips, and Vibes."
                complete={vibeComplete}
                completionLabel={vibeComplete ? "Complete" : "Not started"}
                actions={
                  vibeComplete ? (
                    <>
                      <Link
                        href="/onboarding/vibe-check/reveal?returnTo=%2Fprofile"
                        className="rounded-full border-2 border-ink bg-white px-3 py-1.5 text-xs font-extrabold text-navy"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={redoQuiz}
                        disabled={redoing}
                        className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-cream px-3 py-1.5 text-xs font-extrabold text-navy disabled:opacity-50"
                      >
                        <RefreshCw size={12} /> {redoing ? "Resetting…" : "Retake"}
                      </button>
                    </>
                  ) : (
                    <Link
                      href="/onboarding/vibe-check?returnTo=%2Fprofile"
                      className="rounded-full border-2 border-ink bg-flockie-coral px-3 py-1.5 text-xs font-extrabold text-white"
                    >
                      Start
                    </Link>
                  )
                }
              />

              <SetupCard
                emoji="🧳"
                title="Trip vibe"
                description="Pace, budget, planning, nightlife, travel style, and trip dealbreakers."
                complete={tripComplete}
                completionLabel={tripComplete ? "Complete" : "Add preferences"}
                actions={
                  <button
                    type="button"
                    onClick={() => setOpenSetup("trip")}
                    className="rounded-full border-2 border-ink bg-white px-3 py-1.5 text-xs font-extrabold text-navy"
                  >
                    {tripComplete ? "Edit" : "Start"}
                  </button>
                }
              />

              <SetupCard
                emoji="🎯"
                title="Activity vibe"
                description="Activities, skill levels, intensity, group size, and activity dealbreakers."
                complete={activityComplete}
                completionLabel={activityComplete ? "Complete" : "Add preferences"}
                actions={
                  <button
                    type="button"
                    onClick={() => setOpenSetup("activity")}
                    className="rounded-full border-2 border-ink bg-white px-3 py-1.5 text-xs font-extrabold text-navy"
                  >
                    {activityComplete ? "Edit" : "Start"}
                  </button>
                }
              />
            </div>

            <p className="mt-3 rounded-2xl bg-cream px-3 py-2.5 text-xs font-medium leading-relaxed text-navy/70">
              Soft preferences improve ranking. Dealbreakers strictly filter. Interest,
              Not for me, invitation responses, attendance, and reviews also teach the
              algorithm.
            </p>
          </Panel>

          <Panel
            title="Visibility summary"
            description="This is informational for now; existing privacy behavior is unchanged in PR 1."
            badge={
              <Link
                href="/settings"
                className="text-xs font-extrabold text-flockie-coral"
              >
                Settings →
              </Link>
            }
          >
            <VisibilityRow
              icon="👤"
              title="Public profile"
              description="Photo, name, age, city, bio, public interests, reviews, and Flockie activity."
              label="Visible"
            />
            <VisibilityRow
              icon="🔒"
              title="Match setup"
              description="Raw quiz answers, preferences, dealbreakers, and behavioral signals."
              label="Only you"
            />
            <VisibilityRow
              icon="📅"
              title="Plan visibility"
              description="Private trips and activities stay owner-only; public Vibes and flocks follow existing visibility rules."
              label="Existing rules"
            />
          </Panel>

          <Panel
            title="My upcoming plans"
            description="A management preview. Private trips stay owner-only; public Vibes and flocks may also appear publicly."
            badge={
              <Link href="/my-vibes" className="text-xs font-extrabold text-flockie-coral">
                See all →
              </Link>
            }
          >
            {upcoming.length > 0 ? (
              <div className="space-y-2">
                {upcoming.slice(0, 3).map((item) => (
                  <UpcomingRow key={item.key} item={item} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-ink/15 bg-[#FCF9F4] p-5 text-center">
                <p className="text-sm font-bold text-navy">No upcoming plans yet.</p>
                <Link
                  href="/vibes"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-extrabold text-flockie-coral"
                >
                  Explore Vibes <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </Panel>

          <Panel
            title="Reviews"
            description="Verified feedback from completed Flockie interactions."
            badge={
              reviewItems.length > 2 ? (
                <button
                  type="button"
                  onClick={() => setShowAllReviews((value) => !value)}
                  className="text-xs font-extrabold text-flockie-coral"
                >
                  {showAllReviews ? "Show less" : `See all ${reviewCount}`} →
                </button>
              ) : undefined
            }
          >
            {visibleReviews.length > 0 ? (
              <div className="space-y-2">
                {visibleReviews.map((review) => (
                  <ReviewRow key={review.id} review={review} />
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-[#FCF9F4] p-4 text-sm font-medium text-muted">
                No reviews yet — they appear after completed Flockie interactions.
              </p>
            )}
          </Panel>
        </div>
      </div>

      {openSetup === "trip" && (
        <TripVibeForm
          userId={userId}
          onDone={setupDone}
          onClose={() => setOpenSetup(null)}
        />
      )}
      {openSetup === "activity" && (
        <ActivityVibeForm
          userId={userId}
          onDone={setupDone}
          onClose={() => setOpenSetup(null)}
        />
      )}
    </>
  );
}

function Panel({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[26px] border-2 border-ink bg-white p-4 shadow-[0_4px_0_0_#10233d]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-fredoka text-xl font-bold text-navy">{title}</h3>
          <p className="mt-1 text-xs font-medium leading-relaxed text-muted">
            {description}
          </p>
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

function SetupCard({
  emoji,
  title,
  description,
  complete,
  completionLabel,
  actions,
}: {
  emoji: string;
  title: string;
  description: string;
  complete: boolean;
  completionLabel: string;
  actions: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border-2 border-ink/10 bg-[#FCF9F4] p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-ink bg-cream text-2xl">
        {emoji}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-fredoka text-base font-semibold text-navy">{title}</h4>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
              complete
                ? "bg-emerald-100 text-emerald-700"
                : "bg-flockie-coral/15 text-flockie-coral"
            }`}
          >
            {complete && <Check size={10} strokeWidth={3} />} {completionLabel}
          </span>
        </div>
        <p className="mt-1 text-xs font-medium leading-relaxed text-muted">
          {description}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5 sm:justify-end">{actions}</div>
    </div>
  );
}

function VisibilityRow({
  icon,
  title,
  description,
  label,
}: {
  icon: string;
  title: string;
  description: string;
  label: string;
}) {
  const VisibilityIcon = label === "Only you" ? LockKeyhole : Eye;

  return (
    <div className="flex items-start gap-3 border-t border-ink/10 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <span className="text-lg">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-navy">{title}</p>
        <p className="mt-0.5 text-xs font-medium leading-relaxed text-muted">
          {description}
        </p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cream px-2 py-1 text-[10px] font-extrabold text-muted">
        <VisibilityIcon size={10} /> {label}
      </span>
    </div>
  );
}

type UpcomingItem = {
  key: string;
  title: string;
  subtitle: string;
  role?: string;
  photo: string | null;
  emoji: string;
  href: string;
  sortValue: number;
};

function buildUpcoming(events?: EventsData): UpcomingItem[] {
  const vibes =
    events?.vibes
      ?.filter((item) => !item.past)
      .map((item, index) => ({
        key: `vibe-${item.id}-${index}`,
        title: item.title,
        subtitle: formatVibeWhen(item.starts_at),
        role: item.role === "host" ? "Host" : "Going",
        photo: item.photo,
        emoji: "🎟️",
        href: `/vibes/${item.id}`,
        sortValue: +new Date(item.starts_at),
      })) ?? [];
  const tripItems = [
    ...(events?.flocks ?? []).map((item, index) => ({
      key: `flock-${item.id}-${index}`,
      title: item.destination || "Flock",
      subtitle: item.start_date,
      role: item.role === "host" ? "Host" : "Going",
      photo: item.photo,
      emoji: "🧳",
      href: "/my-trips",
      sortValue: +new Date(item.start_date),
      past: item.past,
    })),
    ...(events?.activities ?? []).map((item, index) => ({
      key: `activity-${item.id}-${index}`,
      title: item.title || "Activity",
      subtitle: item.start_date,
      role: "Plan",
      photo: item.photo,
      emoji: "🎯",
      href: "/my-trips",
      sortValue: +new Date(item.start_date),
      past: item.past,
    })),
    ...(events?.trips ?? []).map((item, index) => ({
      key: `trip-${item.id}-${index}`,
      title: item.destination || "Trip",
      subtitle: item.start_date,
      role: "Trip",
      photo: item.photo,
      emoji: "✈️",
      href: "/my-trips",
      sortValue: +new Date(item.start_date),
      past: item.past,
    })),
  ]
    .filter((item) => !item.past)
    .map(({ past: _past, ...item }) => item);

  return [...vibes, ...tripItems].sort((a, b) => a.sortValue - b.sortValue);
}

function UpcomingRow({ item }: { item: UpcomingItem }) {
  return (
    <Link
      href={item.href}
      className="flex items-center gap-3 rounded-2xl border-2 border-ink/10 bg-[#FCF9F4] p-2.5"
    >
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-ink bg-cream text-xl">
        {item.photo ? (
          <Image src={item.photo} alt="" fill sizes="48px" className="object-cover" />
        ) : (
          item.emoji
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold text-navy">
          {item.title}
        </span>
        <span className="block truncate text-xs font-medium text-muted">
          {item.subtitle}
        </span>
      </span>
      {item.role && (
        <span className="rounded-full bg-cream px-2 py-1 text-[10px] font-extrabold uppercase text-muted">
          {item.role}
        </span>
      )}
    </Link>
  );
}

function ReviewRow({ review }: { review: ReviewItem }) {
  return (
    <article className="rounded-2xl border-2 border-ink/10 bg-[#FCF9F4] p-3">
      <div className="flex items-center gap-2">
        {review.reviewerPhoto ? (
          <Image
            src={review.reviewerPhoto}
            alt=""
            width={30}
            height={30}
            className="h-[30px] w-[30px] rounded-full object-cover"
          />
        ) : (
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-flockie-blue text-xs font-bold text-white">
            {review.reviewerName[0]?.toUpperCase()}
          </span>
        )}
        <p className="text-sm font-extrabold text-navy">{review.reviewerName}</p>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-extrabold text-emerald-700">
          Verified interaction
        </span>
        <time className="ml-auto text-[10px] font-medium text-muted">
          {format(new Date(review.created_at), "MMM yyyy")}
        </time>
      </div>
      {review.comment && (
        <p className="mt-2 text-sm font-medium leading-relaxed text-navy/75">
          “{review.comment}”
        </p>
      )}
    </article>
  );
}
