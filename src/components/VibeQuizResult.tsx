import { ARCHETYPES } from "@/lib/onboarding/archetypes";
import { pct } from "@/lib/onboarding/scoring";
import type { VibeDimension, VibeScores } from "@/lib/onboarding/types";

// The personality vibe result, styled like the reveal screens. Reused on the
// profile "Vibe quiz" tab.
export default function VibeQuizResult({
  archetypeKey,
  scores,
}: {
  archetypeKey: string;
  scores?: VibeScores | null;
}) {
  const archetype = ARCHETYPES[archetypeKey as VibeDimension];
  if (!archetype) return null;
  const s = scores ?? null;

  return (
    <div className="font-nunito">
      <div
        style={{ background: `linear-gradient(160deg, ${archetype.gradientFrom}, ${archetype.gradientTo})` }}
        className="flex flex-col items-center rounded-2xl px-6 py-7 text-center"
      >
        <div className="mb-2 text-[44px]">{archetype.emoji}</div>
        <p className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-widest text-white/70">
          Your vibe — early read
        </p>
        <h2 className="mb-2.5 text-[24px] font-black leading-tight text-white">{archetype.name}</h2>
        <p className="max-w-[300px] text-[12.5px] font-medium leading-relaxed text-white/90">
          {archetype.description}
        </p>
      </div>

      {s && (
        <Section title="How you're wired">
          <div className="rounded-2xl border-2 border-ink/10 bg-white p-3.5">
            <TraitBar left="Spontaneous" right="Planner" value={pct(s.adventure, s.culture)} />
            <TraitBar left="Social" right="Solo" value={pct(s.social, s.wellness)} />
            <TraitBar left="High-energy" right="Calm" value={pct(s.night, s.wellness)} last />
          </div>
        </Section>
      )}

      <Section title="What this means for matching">
        <div className="rounded-2xl border border-flockie-blue/30 bg-flockie-blue/10 p-3.5 text-[12.5px] font-semibold leading-relaxed text-navy">
          <b>{archetype.name}s get matched differently.</b> {archetype.insight}
        </div>
      </Section>

      <Section title="You'd click with">
        <div className="flex flex-wrap gap-1.5">
          {archetype.compatibleWith.map((dimension) => (
            <span
              key={dimension}
              className="rounded-full border-2 border-ink/10 bg-white px-3.5 py-2 text-[12.5px] font-bold"
            >
              {ARCHETYPES[dimension].emoji} {ARCHETYPES[dimension].name}
            </span>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

function TraitBar({ left, right, value, last }: { left: string; right: string; value: number; last?: boolean }) {
  return (
    <div className={last ? "" : "mb-3.5"}>
      <div className="mb-1.5 flex justify-between text-[11.5px] font-bold">
        <span className="text-navy">{left}</span>
        <span className="text-flockie-coral">{right}</span>
      </div>
      <div className="relative h-[7px] rounded-full bg-cream">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-flockie-blue to-flockie-coral"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
