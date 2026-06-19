import Link from "next/link";
import { redirect } from "next/navigation";
import InviteFriendsButton from "@/components/InviteFriendsButton";
import ArchetypeBadge from "@/components/ArchetypeBadge";
import { ARCHETYPES } from "@/lib/onboarding/archetypes";
import { pct } from "@/lib/onboarding/scoring";
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
    .select("vibe_scores, archetype, home_city, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.archetype || !profile.vibe_scores) {
    redirect("/onboarding/vibe-check");
  }

  const scores = profile.vibe_scores as VibeScores;
  const archetype = ARCHETYPES[profile.archetype as VibeDimension];
  if (!archetype) redirect("/onboarding/vibe-check");

  const nearby = profile.home_city
    ? await getNearbyVibes(profile.home_city)
    : [];

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-cream font-nunito">
      <div
        style={{ background: `linear-gradient(160deg, ${archetype.gradientFrom}, ${archetype.gradientTo})` }}
        className="flex flex-col items-center px-6 pb-6 pt-8 text-center"
      >
        <div className="mb-2.5"><ArchetypeBadge archetypeKey={profile.archetype} size={72} variant="ring" /></div>
        <p className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-widest text-white/70">Your vibe — early read</p>
        <h1 className="mb-3 text-[25px] font-black leading-tight text-white">{archetype.name}</h1>
        <p className="max-w-[280px] text-[12.5px] font-medium leading-relaxed text-white/90">{archetype.description}</p>
      </div>

      <div className="flex flex-col gap-4 rounded-t-3xl bg-cream px-5 pb-6 pt-5">
        <section className="rounded-2xl border border-[#F3E2BE] bg-[#FFF6E8] p-3.5">
          <div className="flex items-start gap-2.5">
            <span className="text-[19px]">🔍</span>
            <p className="text-[12px] font-semibold leading-relaxed text-[#8A6A1E]"><b className="text-ink">This is your early read</b> — based on 5 quick answers. Confirm it with a few more questions to unlock your real match %.</p>
          </div>
          <Link
            href="/onboarding/trip-vibe"
            className="mt-3 block w-full rounded-2xl border-2 border-ink border-b-[5px] bg-navy py-3.5 text-center text-[15px] font-extrabold text-white"
          >
            Confirm my vibe →
          </Link>
        </section>

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
              <p className="mb-3 text-[12px] font-semibold leading-relaxed text-muted">{profile.home_city ?? "Your city"}&apos;s just getting started on Flockie. Be the spark — invite a friend and your flock grows fast.</p>
              <div className="flex justify-center">
                <InviteFriendsButton city={profile.home_city ?? undefined} label="Invite a friend" />
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

        <Link
          href="/vibes"
          className="block w-full rounded-2xl border-2 border-ink border-b-[5px] bg-flockie-coral py-3.5 text-center text-[15px] font-extrabold text-white"
        >
          See what&apos;s happening nearby →
        </Link>
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
