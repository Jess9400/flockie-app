"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Settings, Sparkles } from "lucide-react";
import { formatVibeWhen } from "@/lib/vibes";
import { isVibePersona, type VibePersona } from "@/lib/onboarding/vibe-onboarding";
import type { EventsData } from "@/components/ProfileEvents";
import type { Profile } from "@/lib/vibe-check";
import ProfileIdentityEditor from "@/components/ProfileIdentityEditor";
import VibeTakeEditor from "@/components/VibeTakeEditor";

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
  takes = [],
  mode = "owner",
}: {
  userId: string;
  profile: StoryProfile;
  events?: EventsData;
  takes?: { vibe_id: string; body: string; updated_at: string }[];
  mode?: "owner" | "public";
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
  const takesByVibeId = new Map(takes.map((take) => [take.vibe_id, take]));

  return (
    <div className="mx-auto max-w-5xl pb-8">
      <section className="overflow-hidden rounded-[30px] border-2 border-ink/15 bg-white shadow-[0_2px_12px_rgba(10,37,69,0.1)]">
        <div className="relative min-h-[360px] overflow-hidden bg-flockie-blue sm:min-h-[430px]">
          {photo ? (
            <Image
              src={photo}
              alt=""
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 1024px"
              // object-top: portrait photos crop from the bottom in this wide
              // hero, never the face.
              className="object-cover object-top"
            />
          ) : (
            <div className="flex h-full min-h-[360px] items-center justify-center text-8xl sm:min-h-[430px]">
              🕊️
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/45 to-transparent" />

          {isOwner && (
            <div className="absolute right-4 top-4 flex gap-2">
              <Link
                href={`/people/${userId}`}
                className="rounded-full border border-ink/15 bg-white/95 px-3.5 py-2 text-xs font-extrabold text-navy shadow-[0_2px_10px_rgba(10,37,69,0.12)]"
              >
                {t("publicView")}
              </Link>
              <Link
                href="/settings"
                aria-label={t("settings")}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 bg-white/95 text-navy shadow-[0_2px_10px_rgba(10,37,69,0.12)]"
              >
                <Settings size={16} />
              </Link>
            </div>
          )}

          {persona && (
            <div className="absolute right-4 top-16 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-navy shadow-[0_5px_16px_rgba(10,37,69,0.18)] sm:right-5 sm:top-5">
              <span className="text-xl">{persona.emoji}</span>
              <span>
                <span className="block text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted">
                  {t("myVibe")}
                </span>
                <span className="block text-sm font-extrabold leading-tight">{t(`personas.${persona.label}`)}</span>
              </span>
            </div>
          )}

          <div className="absolute inset-x-5 bottom-5 text-white sm:inset-x-7 sm:bottom-7">
            <h1 className="font-fredoka text-4xl font-bold leading-none sm:text-5xl">{nameAge}</h1>
            {profile.home_city && <p className="mt-2 text-sm font-bold text-white/90">{profile.home_city}</p>}
          </div>
        </div>

        {isOwner && (upcomingVibe || goal) && (
          <div className="flex gap-2 overflow-x-auto border-b border-ink/10 bg-cream px-4 py-3 sm:px-6">
            {upcomingVibe && (
              <Link
                href={`/vibes/${upcomingVibe.id}`}
                className="flex shrink-0 items-center gap-2 rounded-full border border-flockie-blue/25 bg-white px-3 py-2 text-xs font-extrabold text-navy"
              >
                <span className="h-2 w-2 rounded-full bg-flockie-blue" />
                {t("nextUp", { title: upcomingVibe.title })}
              </Link>
            )}
            {goal && (
              <span className="shrink-0 rounded-full border border-flockie-coral/25 bg-white px-3 py-2 text-xs font-extrabold text-flockie-coral">
                {t("hereFor", { goal })}
              </span>
            )}
          </div>
        )}

        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl flex-1">
              <p className="font-fredoka text-xl font-semibold text-flockie-coral">{t("lineLabel")}</p>
              {profile.bio ? (
                <p className="mt-1 text-xl font-extrabold leading-snug text-navy sm:text-2xl">{profile.bio}</p>
              ) : (
                <p className="mt-1 text-base font-semibold leading-relaxed text-muted">{isOwner ? t("lineEmpty") : t("publicLineEmpty", { name })}</p>
              )}
            </div>
            {isOwner && (
              <button type="button" onClick={() => setEditingProfile(true)} className="inline-flex shrink-0 items-center justify-center rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-extrabold text-navy">
                {t("editProfile")}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="mt-7">
        <div className="flex items-end justify-between gap-4 px-1">
          <div>
            <h2 className="font-fredoka text-2xl font-bold text-navy">{isOwner ? t("historyTitle") : t("publicHistoryTitle", { name })}</h2>
            <p className="mt-1 text-sm font-medium text-muted">{isOwner ? t("historySubtitle") : t("publicHistorySubtitle")}</p>
          </div>
          {completedVibes.length > 0 && (
            <Link href="/my-vibes" className="shrink-0 text-sm font-extrabold text-flockie-coral">
              {t("seeAll")} <ArrowRight className="inline" size={15} />
            </Link>
          )}
        </div>

        {completedVibes.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {completedVibes.map((vibe, index) => {
              const take = takesByVibeId.get(vibe.id);
              return (
                <div key={`${vibe.id}-${vibe.role}-${index}`} className="overflow-hidden rounded-3xl border-2 border-ink/10 bg-white shadow-[0_2px_10px_rgba(10,37,69,0.06)]">
                  <Link href={`/vibes/${vibe.id}`} className="group block">
                    <div className="relative aspect-[16/9] overflow-hidden bg-cream">
                      {vibe.photo ? (
                        <Image src={vibe.photo} alt="" fill sizes="(max-width: 640px) 100vw, 360px" className="object-cover transition duration-300 group-hover:scale-105" />
                      ) : (
                        <span className="flex h-full items-center justify-center text-4xl">✨</span>
                      )}
                    </div>
                    <div className="p-4 pb-0">
                      <p className="truncate text-base font-extrabold text-navy">{vibe.title}</p>
                      <p className="mt-1 text-sm font-semibold text-muted">{formatVibeWhen(vibe.starts_at, locale)}</p>
                      <p className="mt-2 text-xs font-extrabold text-flockie-coral">
                        {vibe.role === "host" ? t("hosted") : t("joined")}
                      </p>
                    </div>
                  </Link>
                  {/* Takes are private to the owner — never rendered on the
                      public profile (mode gating landed after this feature). */}
                  {isOwner && (
                    <div className="p-4 pt-3">
                      {take && (
                        <div className="rounded-2xl bg-cream px-3 py-2.5">
                          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">{t("takes.label")}</p>
                          <p className="mt-1 text-sm font-semibold leading-relaxed text-navy">{take.body}</p>
                        </div>
                      )}
                      <VibeTakeEditor vibeId={vibe.id} vibeTitle={vibe.title} initialBody={take?.body} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-3xl border-2 border-dashed border-ink/15 bg-white px-6 py-10 text-center">
            <div className="text-4xl">📖</div>
            <h3 className="mt-3 font-fredoka text-xl font-bold text-navy">{isOwner ? t("emptyTitle") : t("publicEmptyTitle")}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-relaxed text-muted">{isOwner ? t("emptyBody") : t("publicEmptyBody", { name })}</p>
            {isOwner && (
              <Link
                href="/vibes"
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-flockie-coral px-5 py-3 text-sm font-extrabold text-white"
              >
                <Sparkles size={16} /> {t("browseVibes")}
              </Link>
            )}
          </div>
        )}
      </section>

      {isOwner && (
        <section className="mt-7 flex flex-col items-start justify-between gap-4 rounded-3xl border border-ink/10 bg-flockie-blue/10 p-5 sm:flex-row sm:items-center sm:p-6">
          <div>
            <h2 className="font-fredoka text-xl font-bold text-navy">{t("vibeTitle")}</h2>
            <p className="mt-1 max-w-xl text-sm font-medium leading-relaxed text-navy/70">{t("vibeBody")}</p>
          </div>
          <Link href="/onboarding/vibe-check/reveal?returnTo=%2Fprofile" className="shrink-0 rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-extrabold text-navy">
            {t("adjustVibe")}
          </Link>
        </section>
      )}

      {isOwner && editingProfile && <ProfileIdentityEditor initial={profile} onClose={() => setEditingProfile(false)} />}
    </div>
  );
}
