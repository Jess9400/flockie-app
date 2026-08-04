"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { dfLocale } from "@/lib/date-locale";
import { useTranslations, useLocale } from "next-intl";
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
import { useConfirm, useToast } from "@/components/ui/feedback";
import { ARCHETYPES } from "@/lib/onboarding/archetypes";
import { restartVibeCheck } from "@/lib/onboarding/vibe-actions";
import type { VibeDimension, VibeScores } from "@/lib/onboarding/types";
import { formatVibeWhen } from "@/lib/vibes";
import type { Profile } from "@/lib/vibe-check";

type DashboardProfile = Partial<Profile> & {
  archetype?: string | null;
  vibe_scores?: VibeScores | null;
  vibe_completed_at?: string | null;
  trip_prefs_complete?: boolean | null;
  activity_prefs_complete?: boolean | null;
  social_visibility?: "members" | "connections" | "private" | null;
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
  const t = useTranslations("profile");
  const locale = useLocale();
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [openSetup, setOpenSetup] = useState<SetupKey>(null);
  const [redoing, setRedoing] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  // A kept old result with no completed flag = retake in progress: the old
  // vibe keeps powering matching until the new run finishes.
  const hasVibeResult = !!(profile.archetype && profile.vibe_scores);
  const vibeComplete = hasVibeResult && !!profile.vibe_completed_at;
  const vibeRetaking = hasVibeResult && !profile.vibe_completed_at;
  const vibeArchetype = profile.archetype
    ? ARCHETYPES[profile.archetype as VibeDimension] ?? null
    : null;
  const tripComplete = !!profile.trip_prefs_complete || profile.planning != null;
  const activityComplete =
    !!profile.activity_prefs_complete || (profile.activities?.length ?? 0) > 0;
  const socialVisibility = profile.social_visibility ?? "connections";
  const upcoming = useMemo(() => buildUpcoming(events, locale), [events, locale]);
  const visibleReviews = showAllReviews ? reviewItems : reviewItems.slice(0, 2);

  function setupDone() {
    setOpenSetup(null);
    router.refresh();
  }

  async function redoQuiz() {
    if (
      !(await confirm({
        title: t("dashboard.redoConfirm.title"),
        message: t("dashboard.redoConfirm.message"),
        confirmLabel: t("dashboard.redoConfirm.confirmLabel"),
      }))
    ) {
      return;
    }
    setRedoing(true);
    try {
      await restartVibeCheck();
      router.push("/onboarding/vibe-check?returnTo=%2Fprofile");
    } catch {
      setRedoing(false);
      toast(t("dashboard.redoError"), "error");
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
                {t("dashboard.heading")}
              </h2>
              <p className="mt-1.5 text-sm font-medium text-muted">
                {t("dashboard.subheading")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/people/${userId}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3 py-2 text-xs font-extrabold text-navy shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
              >
                <Eye size={14} /> {t("dashboard.publicProfile")}
              </Link>
              <button
                type="button"
                onClick={onShare}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3 py-2 text-xs font-extrabold text-navy shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
              >
                <Share2 size={14} /> {t("dashboard.share")}
              </button>
              <Link
                href="/settings"
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3 py-2 text-xs font-extrabold text-navy shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
              >
                <Settings size={14} /> {t("dashboard.settings")}
              </Link>
            </div>
          </header>

          <Panel
            title={t("dashboard.matchSetup.title")}
            description={t("dashboard.matchSetup.description")}
            badge={
              <span className="rounded-full bg-flockie-coral/15 px-2.5 py-1 text-[10px] font-extrabold text-flockie-coral">
                {t("dashboard.matchSetup.privateBadge")}
              </span>
            }
          >
            {vibeArchetype && (
              <div
                className="mb-2.5 flex items-center gap-3 rounded-2xl border-2 border-ink/10 p-3"
                style={{
                  background: `linear-gradient(135deg, ${vibeArchetype.gradientFrom}14, ${vibeArchetype.gradientTo}14)`,
                }}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-ink/15 bg-white text-2xl">
                  {vibeArchetype.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-extrabold uppercase tracking-wide text-muted">
                    {t("dashboard.yourVibe")}
                  </span>
                  <span className="block font-fredoka text-base font-semibold text-navy">
                    {vibeArchetype.name}
                  </span>
                  {vibeRetaking ? (
                    <span className="block text-[10.5px] font-bold text-flockie-coral">
                      {t("dashboard.vibeUpdatesWhenDone")}
                    </span>
                  ) : (
                    <span className="block text-[10.5px] font-semibold text-muted">
                      {t("dashboard.vibeBuiltFromAnswers")}
                    </span>
                  )}
                </span>
                <Link
                  href="/onboarding/vibe-check/reveal?returnTo=%2Fprofile"
                  className="shrink-0 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-extrabold text-navy"
                >
                  {t("dashboard.view")}
                </Link>
              </div>
            )}

            <div className="space-y-2.5">
              <SetupCard
                emoji="🧬"
                title={t("dashboard.vibeQuiz.title")}
                description={t("dashboard.vibeQuiz.description")}
                complete={vibeComplete}
                completionLabel={
                  vibeComplete
                    ? t("dashboard.vibeQuiz.complete")
                    : vibeRetaking
                      ? t("dashboard.vibeQuiz.finishYourQuiz")
                      : t("dashboard.vibeQuiz.notStarted")
                }
                actions={
                  vibeComplete ? (
                    <button
                      type="button"
                      onClick={redoQuiz}
                      disabled={redoing}
                      className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-extrabold text-navy disabled:opacity-50"
                    >
                      <RefreshCw size={12} />{" "}
                      {redoing ? t("dashboard.vibeQuiz.starting") : t("dashboard.vibeQuiz.retake")}
                    </button>
                  ) : vibeRetaking ? (
                    <Link
                      href="/onboarding/vibe-check?returnTo=%2Fprofile"
                      className="rounded-full border border-ink/15 bg-flockie-coral px-3 py-1.5 text-xs font-extrabold text-white"
                    >
                      {t("dashboard.vibeQuiz.finishQuiz")}
                    </Link>
                  ) : (
                    <Link
                      href="/onboarding/vibe-check?returnTo=%2Fprofile"
                      className="rounded-full border border-ink/15 bg-flockie-coral px-3 py-1.5 text-xs font-extrabold text-white"
                    >
                      {t("dashboard.vibeQuiz.start")}
                    </Link>
                  )
                }
              />

              <SetupCard
                emoji="🧳"
                title={t("dashboard.tripVibe.title")}
                description={t("dashboard.tripVibe.description")}
                complete={tripComplete}
                completionLabel={
                  tripComplete
                    ? t("dashboard.tripVibe.complete")
                    : t("dashboard.tripVibe.addPreferences")
                }
                actions={
                  <button
                    type="button"
                    onClick={() => setOpenSetup("trip")}
                    className={
                      tripComplete
                        ? "rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-extrabold text-navy"
                        : "rounded-full border border-ink/15 bg-flockie-coral px-3 py-1.5 text-xs font-extrabold text-white"
                    }
                  >
                    {tripComplete ? t("dashboard.tripVibe.retake") : t("dashboard.tripVibe.start")}
                  </button>
                }
              />

              <SetupCard
                emoji="🎯"
                title={t("dashboard.activityVibe.title")}
                description={t("dashboard.activityVibe.description")}
                complete={activityComplete}
                completionLabel={
                  activityComplete
                    ? t("dashboard.activityVibe.complete")
                    : t("dashboard.activityVibe.addPreferences")
                }
                actions={
                  <button
                    type="button"
                    onClick={() => setOpenSetup("activity")}
                    className={
                      activityComplete
                        ? "rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-extrabold text-navy"
                        : "rounded-full border border-ink/15 bg-flockie-coral px-3 py-1.5 text-xs font-extrabold text-white"
                    }
                  >
                    {activityComplete
                      ? t("dashboard.activityVibe.retake")
                      : t("dashboard.activityVibe.start")}
                  </button>
                }
              />
            </div>

            <p className="mt-3 rounded-2xl bg-cream px-3 py-2.5 text-xs font-medium leading-relaxed text-navy/70">
              {t("dashboard.matchSetupNote")}
            </p>
          </Panel>

          <Panel
            title={t("dashboard.visibility.title")}
            description={t("dashboard.visibility.description")}
            badge={
              <Link
                href="/settings"
                className="text-xs font-extrabold text-flockie-coral"
              >
                {t("dashboard.visibility.settingsLink")}
              </Link>
            }
          >
            <VisibilityRow
              icon="👤"
              title={t("dashboard.visibility.publicProfileTitle")}
              description={t("dashboard.visibility.publicProfileDesc")}
              label={t("dashboard.visibility.labelVisible")}
            />
            <VisibilityRow
              icon="🔗"
              title={t("dashboard.visibility.socialAccountsTitle")}
              description={
                socialVisibility === "members"
                  ? t("dashboard.visibility.socialMembersDesc")
                  : socialVisibility === "private"
                    ? t("dashboard.visibility.socialPrivateDesc")
                    : t("dashboard.visibility.socialConnectionsDesc")
              }
              label={
                socialVisibility === "members"
                  ? t("dashboard.visibility.labelMembers")
                  : socialVisibility === "private"
                    ? t("dashboard.visibility.labelOnlyYou")
                    : t("dashboard.visibility.labelConnections")
              }
              locked={socialVisibility === "private"}
            />
            <VisibilityRow
              icon="🔒"
              title={t("dashboard.visibility.matchSetupTitle")}
              description={t("dashboard.visibility.matchSetupDesc")}
              label={t("dashboard.visibility.labelOnlyYou")}
              locked
            />
            <VisibilityRow
              icon="📅"
              title={t("dashboard.visibility.planVisibilityTitle")}
              description={t("dashboard.visibility.planVisibilityDesc")}
              label={t("dashboard.visibility.labelProfileDisplay")}
            />
          </Panel>

          <Panel
            title={t("dashboard.upcoming.title")}
            description={t("dashboard.upcoming.description")}
            badge={
              <Link href="/my-vibes" className="text-xs font-extrabold text-flockie-coral">
                {t("dashboard.upcoming.seeAll")}
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
                <p className="text-sm font-bold text-navy">{t("dashboard.upcoming.empty")}</p>
                <Link
                  href="/vibes"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-extrabold text-flockie-coral"
                >
                  {t("dashboard.upcoming.exploreVibes")} <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </Panel>

          <Panel
            title={t("dashboard.reviews.title")}
            description={t("dashboard.reviews.description")}
            badge={
              reviewItems.length > 2 ? (
                <button
                  type="button"
                  onClick={() => setShowAllReviews((value) => !value)}
                  className="text-xs font-extrabold text-flockie-coral"
                >
                  {showAllReviews
                    ? t("dashboard.reviews.showLess")
                    : t("dashboard.reviews.seeAllCount", { count: reviewCount })}{" "}
                  →
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
                {t("dashboard.reviews.empty")}
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
    <section className="rounded-[26px] border border-ink/15 bg-white p-4 shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
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
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-ink/15 bg-cream text-2xl">
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
  locked = false,
}: {
  icon: string;
  title: string;
  description: string;
  label: string;
  locked?: boolean;
}) {
  const VisibilityIcon = locked ? LockKeyhole : Eye;

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

function buildUpcoming(events?: EventsData, locale = "en"): UpcomingItem[] {
  const vibes =
    events?.vibes
      ?.filter((item) => !item.past)
      .map((item, index) => ({
        key: `vibe-${item.id}-${index}`,
        title: item.title,
        subtitle: formatVibeWhen(item.starts_at, locale, item.timezone ?? undefined),
        role: item.role === "host" ? "host" : "going",
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
      role: item.role === "host" ? "host" : "going",
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
      role: "plan",
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
      role: "trip",
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
  const t = useTranslations("profile");
  return (
    <Link
      href={item.href}
      className="flex items-center gap-3 rounded-2xl border-2 border-ink/10 bg-[#FCF9F4] p-2.5"
    >
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-ink/15 bg-cream text-xl">
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
          {t(`dashboard.roles.${item.role}`)}
        </span>
      )}
    </Link>
  );
}

function ReviewRow({ review }: { review: ReviewItem }) {
  const t = useTranslations("profile");
  const locale = useLocale();
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
          {t("dashboard.reviews.verified")}
        </span>
        <time className="ml-auto text-[10px] font-medium text-muted">
          {format(new Date(review.created_at), "MMM yyyy", { locale: dfLocale(locale) })}
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
