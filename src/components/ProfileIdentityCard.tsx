"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin, Pencil, Settings, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import ProfileSocials from "@/components/ProfileSocials";
import { ARCHETYPES } from "@/lib/onboarding/archetypes";
import type { VibeDimension } from "@/lib/onboarding/types";
import { topVibeTags, type Profile } from "@/lib/vibe-check";

type IdentityProfile = Partial<Profile> & {
  archetype?: string | null;
};

export default function ProfileIdentityCard({
  profile,
  reviewCount,
  stats,
  onEdit,
  onShare,
  mode = "owner",
}: {
  profile: IdentityProfile;
  reviewCount: number;
  stats?: Record<string, number>;
  onEdit?: () => void;
  onShare?: () => void;
  mode?: "owner" | "public";
}) {
  const t = useTranslations("profile");
  const isOwner = mode === "owner";
  const photo = profile.photos?.[0];
  const nameAge = [profile.display_name?.trim(), profile.age ? String(profile.age) : null]
    .filter(Boolean)
    .join(", ");
  const archetype = profile.archetype
    ? ARCHETYPES[profile.archetype as VibeDimension]
    : null;
  const tags = topVibeTags(profile);

  return (
    <section className="overflow-hidden rounded-[28px] border-2 border-ink/15 bg-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
      <div className="relative aspect-[4/5] min-h-[390px] overflow-hidden bg-cream">
        {photo ? (
          <Image
            src={photo}
            alt=""
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 390px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-7xl">🕊️</div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-navy via-navy/45 to-transparent" />

        {isOwner && (
          <div className="absolute right-3 top-3 flex gap-2">
            {onShare && (
              <button
                type="button"
                onClick={onShare}
                aria-label={t("identity.shareAria")}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 bg-white/95 text-navy shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
              >
                <Share2 size={17} />
              </button>
            )}
            <Link
              href="/settings"
              aria-label={t("identity.settingsAria")}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 bg-white/95 text-navy shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
            >
              <Settings size={17} />
            </Link>
          </div>
        )}

        <div className="absolute inset-x-5 bottom-5 text-white">
          <h1 className="font-fredoka text-4xl font-bold leading-none">
            {nameAge || t("identity.titleFallback")}
          </h1>
          {(profile.home_city || archetype) && (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-white/90">
              {profile.home_city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} /> {profile.home_city}
                </span>
              )}
              {profile.home_city && archetype && <span>·</span>}
              {archetype && <span>{archetype.name}</span>}
            </p>
          )}
        </div>
      </div>

      <div className="p-4">
        {profile.bio ? (
          <p className="whitespace-pre-line text-sm font-medium leading-relaxed text-navy/80">
            {profile.bio}
          </p>
        ) : isOwner ? (
          <p className="text-sm font-medium text-muted">
            {t("identity.bioPrompt")}
          </p>
        ) : null}

        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border-2 border-ink/10 bg-cream px-3 py-1.5 text-xs font-extrabold text-navy"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3">
          <ProfileSocials
            instagram={profile.instagram}
            x_handle={profile.x_handle}
            tiktok={profile.tiktok}
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <TrustItem value={reviewCount} label={t("identity.reviews")} />
          <TrustItem value={stats?.vibes_attended ?? 0} label={t("identity.vibesJoined")} />
          <TrustItem value={stats?.vibes_hosted ?? 0} label={t("identity.hosted")} />
        </div>

        {isOwner && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-flockie-coral px-5 py-2.5 font-fredoka text-sm font-semibold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
          >
            <Pencil size={15} /> {t("identity.editPublic")}
          </button>
        )}
      </div>
    </section>
  );
}

function TrustItem({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border-2 border-ink/10 bg-[#FCF9F4] px-2 py-2.5 text-center">
      <p className="text-xl font-black leading-none text-navy">{value}</p>
      <p className="mt-1 text-[10px] font-extrabold leading-tight text-muted">{label}</p>
    </div>
  );
}
