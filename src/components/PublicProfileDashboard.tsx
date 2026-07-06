import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { dfLocale } from "@/lib/date-locale";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import MatchBackButton from "@/components/MatchBackButton";
import PhotoStrip from "@/components/PhotoStrip";
import ProfileIdentityCard from "@/components/ProfileIdentityCard";
import type { EventsData } from "@/components/ProfileEvents";
import type { ReviewItem } from "@/components/ProfileReviews";
import { ARCHETYPES } from "@/lib/onboarding/archetypes";
import type { VibeDimension } from "@/lib/onboarding/types";
import { formatVibeWhen } from "@/lib/vibes";
import type { Profile } from "@/lib/vibe-check";

type PublicProfile = Partial<Profile> & {
  archetype?: string | null;
};

export default async function PublicProfileDashboard({
  personId,
  profile,
  reviewItems,
  stats,
  events,
  incomingLike,
}: {
  personId: string;
  profile: PublicProfile;
  reviewItems: ReviewItem[];
  stats?: Record<string, number>;
  events?: EventsData;
  incomingLike: boolean;
}) {
  const t = await getTranslations("profile");
  const locale = await getLocale();
  const tvc = await getTranslations("vibeCheck");
  const tc = await getTranslations("components");
  const firstName = (profile.display_name || t("public.nameFallback")).split(" ")[0];
  const archetype = profile.archetype
    ? ARCHETYPES[profile.archetype as VibeDimension]
    : null;
  const photos = profile.photos?.slice(1) ?? [];
  // Stored vibe values are the lib's English phrases; resolve to the locale with
  // a raw-text fallback so custom/unmapped values still render.
  const activityLabel = (a: string) => (tvc.has(`activities.${a}`) ? tvc(`activities.${a}`) : a);
  const vibeTagLabel = (v: string) =>
    tvc.has(`activityVibes.${v}`)
      ? tvc(`activityVibes.${v}`)
      : tc.has(`tripTypes.${v}`)
        ? tc(`tripTypes.${v}`)
        : v;
  const vibeTags = uniqueItems([
    ...(profile.activity_vibe ?? []),
    ...(profile.trip_vibe ?? []),
  ]).map((v) => ({ key: v, label: vibeTagLabel(v) }));
  const activities = uniqueItems(profile.activities ?? []).map((a) => ({ key: a, label: activityLabel(a) }));
  const history = buildHistory(events, locale);
  const roleLabel = (role: string) => t(`public.roles.${role}`);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(300px,390px)_minmax(0,1fr)] lg:items-start">
      <div className="lg:sticky lg:top-6">
        <ProfileIdentityCard
          profile={profile}
          reviewCount={reviewItems.length}
          stats={stats}
          mode="public"
        />
        {incomingLike && (
          <MatchBackButton personId={personId} name={firstName} />
        )}
      </div>

      <div className="min-w-0 space-y-4">
        <Panel
          title={t("public.about", { name: firstName })}
          description={t("public.aboutDescription")}
        >
          {archetype && (
            <div
              className="rounded-2xl border-2 border-ink/10 p-4"
              style={{
                background: `linear-gradient(135deg, ${archetype.gradientFrom}14, ${archetype.gradientTo}14)`,
              }}
            >
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted">
                {t("public.theirVibe")}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-2xl">{archetype.emoji}</span>
                <h2 className="font-fredoka text-xl font-bold text-navy">
                  {archetype.name}
                </h2>
              </div>
              <p className="mt-2 text-sm font-medium leading-relaxed text-navy/75">
                {t(`archetypes.${archetype.key}.description`)}
              </p>
            </div>
          )}

          {profile.one_liner && (
            <blockquote className="mt-3 rounded-2xl bg-cream px-4 py-3 font-fredoka text-lg font-semibold italic leading-relaxed text-navy">
              “{profile.one_liner}”
            </blockquote>
          )}

          {activities.length > 0 && (
            <ChipGroup title={t("public.likesDoing")} items={activities} />
          )}
          {vibeTags.length > 0 && (
            <ChipGroup title={t("public.theirKindOfVibe")} items={vibeTags} />
          )}

          {photos.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted">
                {t("public.morePhotos")}
              </p>
              <PhotoStrip photos={photos} />
            </div>
          )}

          {profile.video_url && (
            <video
              src={profile.video_url}
              controls
              className="mt-4 w-full rounded-2xl border-2 border-ink/10"
            />
          )}

          {!archetype &&
            !profile.one_liner &&
            activities.length === 0 &&
            vibeTags.length === 0 &&
            photos.length === 0 &&
            !profile.video_url && (
              <p className="rounded-2xl bg-cream p-4 text-sm font-medium text-muted">
                {t("public.stillAdding", { name: firstName })}
              </p>
            )}
        </Panel>

        <Panel
          title={t("public.history.title")}
          description={t("public.history.description")}
          badge={
            history.length > 0 ? (
              <span className="shrink-0 whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700">
                {t("public.history.completedCount", { count: history.length })}
              </span>
            ) : undefined
          }
        >
          {history.length > 0 ? (
            <div className="space-y-2">
              {history.slice(0, 6).map((item) => (
                <HistoryRow key={item.key} item={item} roleLabel={roleLabel(item.role)} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-cream p-4 text-sm font-medium text-muted">
              {t("public.history.empty")}
            </p>
          )}
        </Panel>

        <Panel
          title={t("public.reviews.title")}
          description={t("public.reviews.description")}
          badge={
            reviewItems.length > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700">
                <CheckCircle2 size={11} /> {t("public.reviews.verifiedCount", { count: reviewItems.length })}
              </span>
            ) : undefined
          }
        >
          {reviewItems.length > 0 ? (
            <div className="space-y-2">
              {reviewItems.map((review) => (
                <ReviewRow
                  key={review.id}
                  review={review}
                  verifiedLabel={t("public.reviews.verified")}
                  noCommentLabel={t("public.reviews.noComment")}
                  locale={locale}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-cream p-4 text-sm font-medium text-muted">
              {t("public.reviews.empty")}
            </p>
          )}
        </Panel>
      </div>
    </div>
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
      <div className="mb-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-fredoka text-xl font-bold text-navy">{title}</h2>
          {badge}
        </div>
        <p className="mt-1 text-xs font-medium leading-relaxed text-muted">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function ChipGroup({ title, items }: { title: string; items: { key: string; label: string }[] }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item.key}
            className="rounded-full border-2 border-ink/10 bg-[#FCF9F4] px-3 py-1.5 text-xs font-extrabold text-navy"
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

type HistoryItem = {
  key: string;
  title: string;
  subtitle: string;
  role: string;
  photo: string | null;
  emoji: string;
  href?: string;
  sortValue: number;
};

function buildHistory(events?: EventsData, locale = "en"): HistoryItem[] {
  const vibes =
    events?.vibes
      ?.filter((item) => item.past)
      .map((item, index) => ({
        key: `vibe-${item.id}-${index}`,
        title: item.title,
        subtitle: formatVibeWhen(item.starts_at, locale),
        role: item.role === "host" ? "hosted" : "joined",
        photo: item.photo,
        emoji: "🎟️",
        href: `/vibes/${item.id}`,
        sortValue: +new Date(item.starts_at),
      })) ?? [];
  const flocks =
    events?.flocks
      ?.filter((item) => item.past)
      .map((item, index) => ({
        key: `flock-${item.id}-${index}`,
        title: item.destination || "Flock",
        subtitle: dateRange(item.start_date, item.end_date, locale),
        role: item.role === "host" ? "hosted" : "joined",
        photo: item.photo,
        emoji: "🧳",
        sortValue: +new Date(item.end_date),
      })) ?? [];

  return [...vibes, ...flocks].sort((a, b) => b.sortValue - a.sortValue);
}

function HistoryRow({ item, roleLabel }: { item: HistoryItem; roleLabel: string }) {
  const content = (
    <>
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
      <span className="rounded-full bg-cream px-2 py-1 text-[10px] font-extrabold uppercase text-muted">
        {roleLabel}
      </span>
      {item.href && <ArrowRight size={15} className="shrink-0 text-muted" />}
    </>
  );

  const className =
    "flex items-center gap-3 rounded-2xl border-2 border-ink/10 bg-[#FCF9F4] p-2.5";

  return item.href ? (
    <Link href={item.href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function ReviewRow({
  review,
  verifiedLabel,
  noCommentLabel,
  locale = "en",
}: {
  review: ReviewItem;
  verifiedLabel: string;
  noCommentLabel: string;
  locale?: string;
}) {
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
        <span className="text-sm font-extrabold text-navy">
          {review.reviewerName}
        </span>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-extrabold text-emerald-700">
          {verifiedLabel}
        </span>
        <time className="ml-auto shrink-0 text-[10px] font-medium text-muted">
          {format(new Date(review.created_at), "MMM yyyy", { locale: dfLocale(locale) })}
        </time>
      </div>
      {review.comment ? (
        <p className="mt-2 text-sm font-medium leading-relaxed text-navy/75">
          “{review.comment}”
        </p>
      ) : (
        <p className="mt-2 text-xs font-medium text-muted">
          {noCommentLabel}
        </p>
      )}
    </article>
  );
}

function uniqueItems(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function dateRange(start: string, end: string, locale = "en") {
  const df = dfLocale(locale);
  const startDate = format(new Date(`${start}T00:00:00`), "MMM d, yyyy", { locale: df });
  const endDate = format(new Date(`${end}T00:00:00`), "MMM d, yyyy", { locale: df });
  return start === end ? startDate : `${startDate} – ${endDate}`;
}
