"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, CalendarDays, MapPin, Settings, Sparkles } from "lucide-react";
import { formatVibeWhen } from "@/lib/vibes";
import { isVibePersona, type VibePersona } from "@/lib/onboarding/vibe-onboarding";
import type { EventsData } from "@/components/ProfileEvents";
import type { Profile } from "@/lib/vibe-check";
import type { ProfileStoryReview } from "@/lib/profile-story-reviews";
import ProfileIdentityEditor from "@/components/ProfileIdentityEditor";
import PhotoStrip from "@/components/PhotoStrip";

type StoryProfile = Partial<Profile> & {
  vibe_goal?: string | null;
  vibe_persona?: string | null;
};

const PERSONAS: Record<VibePersona, { emoji: string; label: string }> = {
  connector: { emoji: "🥂", label: "connector" },
  easygoer: { emoji: "😌", label: "easygoer" },
  live_wire: { emoji: "⚡", label: "liveWire" },
  deep_diver: { emoji: "💬", label: "deepDiver" },
};

const GOALS: Record<string, string> = {
  crew: "crew",
  friends: "friends",
  doers: "doers",
  out: "out",
};

export default function ProfileStory({
  userId,
  profile,
  events,
  reviews = [],
  mode = "owner",
  socialStrip,
  postsSection,
}: {
  userId: string;
  profile: StoryProfile;
  events?: EventsData;
  reviews?: ProfileStoryReview[];
  mode?: "owner" | "public";
  socialStrip?: React.ReactNode;
  postsSection?: React.ReactNode;
}) {
  const t = useTranslations("profile.story");
  const locale = useLocale();
  const [editingProfile, setEditingProfile] = useState(false);
  const isOwner = mode === "owner";
  const name = profile.display_name?.trim() || t("nameFallback");
  const nameAge = [name, profile.age ? String(profile.age) : null].filter(Boolean).join(", ");
  const photo = profile.photos?.[0] ?? null;
  const persona = isVibePersona(profile.vibe_persona) ? PERSONAS[profile.vibe_persona] : null;
  const completedVibes = (events?.vibes ?? []).filter((vibe) => vibe.past).slice(0, 6);
  const upcomingVibe = (events?.vibes ?? []).find((vibe) => !vibe.past);
  const goal = profile.vibe_goal && GOALS[profile.vibe_goal] ? t(`goals.${GOALS[profile.vibe_goal]}`) : null;

  return (
    <div className="mx-auto max-w-5xl pb-8">
      <section className="overflow-hidden rounded-[30px] border-2 border-ink/15 bg-white shadow-[0_2px_12px_rgba(10,37,69,0.1)]">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_290px]">
          <div className="p-5 sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[26px] border-2 border-ink/15 bg-cream sm:h-24 sm:w-24">
                  {photo ? (
                    <Image src={photo} alt="" fill priority sizes="96px" className="object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-3xl">{persona?.emoji ?? "🕊️"}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <h1 className="truncate font-fredoka text-3xl font-bold leading-none text-navy sm:text-4xl">{nameAge}</h1>
                  {profile.home_city && (
                    <p className="mt-2 flex items-center gap-1 text-sm font-bold text-muted">
                      <MapPin size={15} aria-hidden /> {profile.home_city}
                    </p>
                  )}
                </div>
              </div>

              {isOwner && (
                <div className="flex shrink-0 gap-2">
                  <Link
                    href={`/people/${userId}`}
                    className="hidden rounded-full border border-ink/15 bg-cream px-3 py-2 text-xs font-extrabold text-navy sm:inline-flex"
                  >
                    {t("publicView")}
                  </Link>
                  <Link
                    href="/settings"
                    aria-label={t("settings")}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 bg-cream text-navy"
                  >
                    <Settings size={16} />
                  </Link>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {persona && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-flockie-blue/12 px-3 py-1.5 text-sm font-extrabold text-navy">
                  <span>{persona.emoji}</span>
                  <span>{t(`personas.${persona.label}`)}</span>
                </span>
              )}
              {isOwner && goal && (
                <span className="rounded-full border border-flockie-coral/25 bg-flockie-coral/5 px-3 py-1.5 text-sm font-extrabold text-flockie-coral">
                  {t("hereFor", { goal })}
                </span>
              )}
            </div>

            <div className="mt-5 border-t border-ink/10 pt-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-flockie-coral">{t("lineLabel")}</p>
              {profile.bio ? (
                <p className="mt-1.5 max-w-2xl text-lg font-extrabold leading-snug text-navy sm:text-xl">{profile.bio}</p>
              ) : (
                <p className="mt-1.5 max-w-2xl text-sm font-semibold leading-relaxed text-muted">
                  {isOwner ? t("lineEmpty") : t("publicLineEmpty", { name })}
                </p>
              )}
            </div>

            {isOwner && (
              <div className="mt-5 flex gap-2 sm:hidden">
                <Link href={`/people/${userId}`} className="rounded-full border border-ink/15 bg-cream px-3 py-2 text-xs font-extrabold text-navy">
                  {t("publicView")}
                </Link>
                <button type="button" onClick={() => setEditingProfile(true)} className="rounded-full border border-ink/15 bg-white px-3 py-2 text-xs font-extrabold text-navy">
                  {t("editProfile")}
                </button>
              </div>
            )}
          </div>

          {isOwner && upcomingVibe && (
            <aside className="border-t border-ink/10 bg-cream p-5 lg:border-l lg:border-t-0 sm:p-6">
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-flockie-coral">{t("rightNow")}</p>
              <h2 className="mt-2 font-fredoka text-2xl font-bold leading-tight text-navy">{upcomingVibe.title}</h2>
              <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-muted">
                <CalendarDays size={15} aria-hidden /> {formatVibeWhen(upcomingVibe.starts_at, locale)}
              </p>
              <Link href={`/vibes/${upcomingVibe.id}`} className="mt-5 inline-flex items-center gap-1 text-sm font-extrabold text-flockie-coral">
                {t("viewPlan")} <ArrowRight size={15} />
              </Link>
            </aside>
          )}
        </div>

        {isOwner && (
          <div className="hidden border-t border-ink/10 px-5 py-3 sm:flex sm:justify-end sm:px-7">
            <button type="button" onClick={() => setEditingProfile(true)} className="rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-extrabold text-navy">
              {t("editProfile")}
            </button>
          </div>
        )}
      </section>

      {socialStrip}

      {/* Photo album — the extra photos beyond the avatar. */}
      {(profile.photos?.length ?? 0) > 1 && (
        <section className="mt-8">
          <h2 className="px-1 font-fredoka text-xl font-bold text-navy">{t("photosHeading")}</h2>
          <div className="mt-3">
            <PhotoStrip photos={(profile.photos ?? []).slice(1)} />
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-end justify-between gap-4 px-1">
          <div>
            <h2 className="font-fredoka text-2xl font-bold text-navy">{isOwner ? t("historyTitle") : t("publicHistoryTitle", { name })}</h2>
            <p className="mt-1 text-sm font-medium text-muted">{isOwner ? t("historySubtitle") : t("publicHistorySubtitle")}</p>
          </div>
          {isOwner && completedVibes.length > 0 && (
            <Link href="/my-vibes" className="shrink-0 text-sm font-extrabold text-flockie-coral">
              {t("seeAll")} <ArrowRight className="inline" size={15} />
            </Link>
          )}
        </div>

        {completedVibes.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {completedVibes.map((vibe, index) => (
              <Link
                key={`${vibe.id}-${vibe.role}-${index}`}
                href={`/vibes/${vibe.id}`}
                className="group overflow-hidden rounded-3xl border-2 border-ink/10 bg-white shadow-[0_2px_10px_rgba(10,37,69,0.06)]"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-cream">
                  {vibe.photo ? (
                    <Image src={vibe.photo} alt="" fill sizes="(max-width: 640px) 100vw, 360px" className="object-cover transition duration-300 group-hover:scale-105" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-4xl">✨</span>
                  )}
                  <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-extrabold text-navy shadow-sm">
                    {vibe.role === "host" ? t("hosted") : t("joined")}
                  </span>
                </div>
                <div className="p-4">
                  <p className="truncate text-base font-extrabold text-navy">{vibe.title}</p>
                  <p className="mt-1 text-sm font-semibold text-muted">{formatVibeWhen(vibe.starts_at, locale)}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-3xl border-2 border-dashed border-ink/15 bg-white px-6 py-10 text-center">
            <div className="text-4xl">📖</div>
            <h3 className="mt-3 font-fredoka text-xl font-bold text-navy">{isOwner ? t("emptyTitle") : t("publicEmptyTitle")}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-relaxed text-muted">{isOwner ? t("emptyBody") : t("publicEmptyBody", { name })}</p>
            {isOwner && (
              <Link href="/vibes" className="mt-5 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-flockie-coral px-5 py-3 text-sm font-extrabold text-white">
                <Sparkles size={16} /> {t("browseVibes")}
              </Link>
            )}
          </div>
        )}
      </section>

      {(reviews.length > 0 || isOwner) && (
        <section className="mt-8">
          <div className="px-1">
            <h2 className="font-fredoka text-2xl font-bold text-navy">{t("kindWordsTitle")}</h2>
            <p className="mt-1 text-sm font-medium text-muted">{t("kindWordsSubtitle")}</p>
          </div>
          {reviews.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {reviews.slice(0, 4).map((review) => (
                <article key={review.id} className="rounded-3xl border-2 border-ink/10 bg-white p-5 shadow-[0_2px_10px_rgba(10,37,69,0.06)]">
                  <p className="text-base font-bold leading-relaxed text-navy">“{review.body}”</p>
                  <div className="mt-4 flex items-center gap-2.5">
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-flockie-blue/15">
                      {review.reviewerPhoto ? (
                        <Image src={review.reviewerPhoto} alt="" fill sizes="32px" className="object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center text-xs font-extrabold text-navy">{review.reviewerName[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-navy">{review.reviewerName}</p>
                      <p className="text-xs font-bold text-muted">{t("verifiedConnection")}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-3xl border-2 border-dashed border-ink/15 bg-white px-6 py-7 text-sm font-medium leading-relaxed text-muted">
              {t("kindWordsEmpty")}
            </div>
          )}
        </section>
      )}

      {isOwner && (
        <section className="mt-8 flex flex-col items-start justify-between gap-4 rounded-3xl border border-ink/10 bg-flockie-blue/10 p-5 sm:flex-row sm:items-center sm:p-6">
          <div>
            <h2 className="font-fredoka text-xl font-bold text-navy">{t("vibeTitle")}</h2>
            <p className="mt-1 max-w-xl text-sm font-medium leading-relaxed text-navy/70">{t("vibeBody")}</p>
          </div>
          <Link href="/onboarding/vibe-check/reveal?returnTo=%2Fprofile" className="shrink-0 rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-extrabold text-navy">
            {t("adjustVibe")}
          </Link>
        </section>
      )}

      {postsSection}

      {isOwner && editingProfile && <ProfileIdentityEditor initial={profile} onClose={() => setEditingProfile(false)} />}
    </div>
  );
}
