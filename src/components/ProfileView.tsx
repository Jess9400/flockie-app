import { SLIDERS, SKILL_CATEGORIES, SKILL_SCALE, type Profile } from "@/lib/vibe-check";
import { ARCHETYPES } from "@/lib/onboarding/archetypes";
import type { VibeDimension } from "@/lib/onboarding/types";
import ArchetypeBadge from "@/components/ArchetypeBadge";
import FingerprintBar from "@/components/FingerprintBar";
import PhotoStrip from "@/components/PhotoStrip";

function ChipGroup({ label, items }: { label: string; items?: string[] | null }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="font-nunito text-[11px] font-bold uppercase tracking-wide text-navy/55">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((t) => (
          <span
            key={t}
            className="rounded-full bg-flockie-coral px-4 py-2 font-nunito text-sm font-semibold text-white"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ProfileView({
  profile,
}: {
  profile: Partial<Profile> & { archetype?: string | null };
}) {
  const p = profile;
  const photos = p.photos ?? [];
  const hero = photos[0];
  const rest = photos.slice(1);
  const nameAge = [p.display_name?.trim(), p.age ? String(p.age) : null]
    .filter(Boolean)
    .join(", ");

  const archetype = p.archetype ? ARCHETYPES[p.archetype as VibeDimension] : null;

  const fingerprints = SLIDERS.map((s) => {
    const val = p[s.key] as number | null | undefined;
    if (val == null) return null;
    return { s, val };
  }).filter(Boolean) as { s: (typeof SLIDERS)[number]; val: number }[];

  const skills = (SKILL_CATEGORIES ?? []).filter(
    (c) => (p.activity_skills?.[c.value] ?? 0) > 0,
  );

  return (
    <div className="font-nunito">
      {/* Hero */}
      {hero ? (
        <div className="relative h-[40vh] w-full overflow-hidden rounded-2xl shadow-[0_8px_24px_rgba(10,37,69,0.18)] md:h-[50vh]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-navy/80 to-transparent" />
          {nameAge && (
            <p className="absolute bottom-5 left-5 font-fredoka text-4xl font-bold text-white drop-shadow-sm md:text-5xl">
              {nameAge}
            </p>
          )}
        </div>
      ) : (
        <div className="flex h-[30vh] w-full items-center justify-center rounded-2xl bg-cream text-5xl">
          🕊️
        </div>
      )}

      {/* City */}
      {p.home_city && (
        <p className="mt-4 font-nunito text-base font-semibold text-navy">
          📍 {p.home_city}
        </p>
      )}

      {/* Archetype / persona */}
      {archetype && (
        <div
          className="mt-4 flex items-start gap-3 rounded-2xl border-2 border-navy p-4"
          style={{ background: `linear-gradient(135deg, ${archetype.gradientFrom}1a, ${archetype.gradientTo}1a)` }}
        >
          <ArchetypeBadge archetypeKey={p.archetype!} size={44} />
          <div>
            <p className="font-nunito text-[11px] font-bold uppercase tracking-wide text-navy/55">
              Their vibe
            </p>
            <p className="font-fredoka text-xl font-bold text-navy">{archetype.name}</p>
            <p className="mt-0.5 font-nunito text-sm font-medium text-navy/70">
              {archetype.description}
            </p>
          </div>
        </div>
      )}

      {/* Photo strip */}
      {rest.length > 0 && (
        <div className="mt-5">
          <PhotoStrip photos={rest} />
        </div>
      )}

      {/* Intro video */}
      {p.video_url && (
        <video src={p.video_url} controls className="mt-5 w-full rounded-2xl" />
      )}

      {/* One-liner quote */}
      {p.one_liner && (
        <figure className="relative px-6 py-10 text-center md:py-12">
          <span className="absolute left-0 top-2 font-fredoka text-6xl leading-none text-flockie-coral">
            &ldquo;
          </span>
          <blockquote className="font-fredoka text-[22px] font-medium italic text-navy md:text-[28px]">
            {p.one_liner}
          </blockquote>
          <span className="absolute bottom-0 right-2 font-fredoka text-6xl leading-none text-flockie-coral">
            &rdquo;
          </span>
        </figure>
      )}

      {/* Vibe fingerprint */}
      {fingerprints.length > 0 && (
        <div className="mt-2 space-y-7">
          {fingerprints.map(({ s, val }) => (
            <FingerprintBar
              key={s.key}
              title={s.label}
              leftLabel={s.scale[0]}
              rightLabel={s.scale[4]}
              value={val}
              answer={s.scale[val - 1]}
            />
          ))}
        </div>
      )}

      {/* Tag chips */}
      <div className="mt-10 space-y-6">
        <ChipGroup label="Trip vibe" items={p.trip_vibe} />
        <ChipGroup label="Travel style" items={p.travel_style} />
        <ChipGroup label="Activities" items={p.activities} />
        <ChipGroup label="Activity vibe" items={p.activity_vibe} />

        {/* Skill levels (per category) */}
        {skills.length > 0 && (
          <div>
            <p className="font-nunito text-[11px] font-bold uppercase tracking-wide text-navy/55">
              Skill levels
            </p>
            <div className="mt-2 space-y-2">
              {skills.map((c) => (
                <div
                  key={c.value}
                  className="flex items-center justify-between rounded-2xl border-2 border-navy/10 bg-cream px-4 py-2.5"
                >
                  <span className="font-nunito text-sm font-semibold text-navy">
                    {c.emoji} {c.label}
                  </span>
                  <span className="font-nunito text-sm font-bold text-flockie-coral">
                    {SKILL_SCALE[(p.activity_skills![c.value] ?? 1) - 1]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
