import Link from "next/link";
import { redirect } from "next/navigation";
import InviteFriendsButton from "@/components/InviteFriendsButton";
import ArchetypeBadge from "@/components/ArchetypeBadge";
import CompleteVibeCard from "@/components/onboarding/CompleteVibeCard";
import { ARCHETYPES } from "@/lib/onboarding/archetypes";
import {
  closeSecondArchetype,
  confidence,
  pct,
} from "@/lib/onboarding/scoring";
import { VibeDimension, VibeScores } from "@/lib/onboarding/types";
import { getNearbyVibes } from "@/lib/onboarding/vibe-actions";
import { createClient } from "@/lib/supabase/server";

export default async function VibeRevealPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("vibe_scores, archetype, home_city, display_name, trip_prefs_complete, activity_prefs_complete")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.archetype || !profile.vibe_scores) {
    redirect("/onboarding/vibe-check");
  }

  const scores = profile.vibe_scores as VibeScores;
  const archetype = ARCHETYPES[profile.archetype as VibeDimension];
  if (!archetype) redirect("/onboarding/vibe-check");

  const confidencePercent = confidence(scores);
  const secondDimension = closeSecondArchetype(scores, archetype.key);
  const secondArchetype = secondDimension
    ? ARCHETYPES[secondDimension]
    : null;

  const nearby = profile.home_city
    ? await getNearbyVibes(profile.home_city)
    : [];

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md bg-cream font-nunito md:max-w-5xl md:px-6 md:py-8">
      <div className="overflow-hidden bg-cream md:rounded-3xl md:border-2 md:border-ink/10 md:shadow-[0_6px_0_0_rgba(26,26,26,0.05)]">
        <div
          style={{ background: `linear-gradient(160deg, ${archetype.gradientFrom}, ${archetype.gradientTo})` }}
          className="flex flex-col items-center px-6 pb-6 pt-7 text-center md:pb-12 md:pt-12"
        >
          <div className="mb-2.5"><ArchetypeBadge archetypeKey={profile.archetype} size={72} variant="ring" /></div>
          <h1 className="mb-2 text-[25px] font-black leading-tight text-white md:text-[32px]">{archetype.name}</h1>
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
            <span className="text-[11px] font-extrabold text-white">
              ≈{confidencePercent}% confident
            </span>
            <span className="text-[10px] font-semibold text-white/65">
              · early read, 5 answers
            </span>
          </div>
          <p className="max-w-[280px] text-[12.5px] font-medium leading-relaxed text-white/90 md:max-w-md md:text-sm">{archetype.description}</p>
          {secondArchetype && (
            <p className="mt-3 max-w-[280px] text-[11.5px] font-semibold leading-relaxed text-white/75 md:max-w-md">
              Could also be leaning {secondArchetype.emoji} {secondArchetype.name} — a few more signals will tell us for sure.
            </p>
          )}
        </div>

        <div className="-mt-1.5 rounded-t-3xl bg-cream px-5 pb-6 pt-5 md:mt-0 md:rounded-none md:px-8 md:pb-9 md:pt-8">
          <div className="md:grid md:grid-cols-2 md:items-start md:gap-7">
            {/* Left column: the "complete your vibe" hub. */}
            <div className="md:sticky md:top-8">
              <CompleteVibeCard
                tripDone={!!profile.trip_prefs_complete}
                activityDone={!!profile.activity_prefs_complete}
              />
            </div>

            {/* Right column: the read on who you are. */}
            <div className="mt-4 flex flex-col gap-4 md:mt-0">
              <Section title="How you're wired">
                <div className="rounded-2xl border-2 border-ink/10 bg-white p-3.5">
                  <TraitBar left="Spontaneous" right="Planner" value={pct(scores.adventure, scores.culture)} />
                  <TraitBar left="Social" right="Solo" value={pct(scores.social, scores.wellness)} />
                  <TraitBar left="High-energy" right="Calm" value={pct(scores.night, scores.wellness)} last />
                </div>
              </Section>

              <Section title="What this means for matching">
                <div className="rounded-2xl border border-flockie-blue/30 bg-flockie-blue/10 p-3.5 text-[12.5px] font-semibold leading-relaxed text-navy"><b>{archetype.name}s get matched differently.</b> {archetype.insight}</div>
              </Section>

              <Section title="You'd click with">
                <div className="flex flex-wrap gap-1.5">
                  {archetype.compatibleWith.map((dimension) => <span key={dimension} className="inline-flex items-center gap-2 rounded-full border-2 border-ink/10 bg-white py-1.5 pl-1.5 pr-3.5 text-[12.5px] font-bold"><ArchetypeBadge archetypeKey={dimension} size={26} /> {ARCHETYPES[dimension].name}</span>)}
                </div>
              </Section>

              <Section title="People near you with this vibe">
                {nearby.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-ink/15 bg-white p-5 text-center">
                    <div className="mb-2 text-[30px]">🌱</div>
                    <p className="mb-1 text-[13.5px] font-extrabold">Nobody&apos;s matched this vibe here yet</p>
                    <p className="mb-3 text-[12px] font-semibold leading-relaxed text-muted">Will your BFF match your vibe? Invite them and find out!</p>
                    <div className="flex justify-center">
                      <InviteFriendsButton city={profile.home_city ?? undefined} label="Invite your BFF" />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {nearby.map((person) => (
                      <div key={person.id} className="flex items-center gap-2.5 rounded-2xl border-2 border-ink/10 bg-white p-2.5">
                        <div className="flex h-[38px] w-[38px] items-center justify-center overflow-hidden rounded-full bg-flockie-blue text-sm font-extrabold text-white">
                          {person.photos?.[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={person.photos[0]} alt="" className="h-full w-full object-cover" />
                          ) : ((person.display_name || "?")[0])}
                        </div>
                        <div><p className="text-[13px] font-extrabold">{person.display_name || "A flockie"}</p><p className="text-[11px] font-semibold text-muted">{ARCHETYPES[person.archetype as VibeDimension]?.name}</p></div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          </div>

          <Link
            href="/vibes"
            className="mt-5 block w-full rounded-2xl border-2 border-ink border-b-[5px] bg-flockie-coral py-3.5 text-center text-[15px] font-extrabold text-white md:mx-auto md:mt-7 md:max-w-md"
          >
            See what&apos;s happening nearby →
          </Link>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-muted">{title}</h2>{children}</section>;
}

function TraitBar({ left, right, value, last }: { left: string; right: string; value: number; last?: boolean }) {
  return <div className={last ? "" : "mb-3.5"}><div className="mb-1.5 flex justify-between text-[11.5px] font-bold"><span className="text-navy">{left}</span><span className="text-red-700">{right}</span></div><div className="relative h-[7px] rounded-full bg-cream"><div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-flockie-blue to-flockie-coral" style={{ width: `${value}%` }} /></div></div>;
}
