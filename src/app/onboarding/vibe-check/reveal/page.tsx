import { redirect } from "next/navigation";
import { VibeReveal } from "@/components/onboarding/VibeReveal";
import { safeRedirectPath } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";
import { formatVibeWhen } from "@/lib/vibes";
import { loadVibeMatch } from "@/lib/vibe-stats";
import type { VibeTraits } from "@/lib/onboarding/vibe-onboarding";

type RecommendedVibe = {
  id: string;
  title: string;
  starts_at: string;
  city: string;
  match_score: number | null;
};

function isVibeTraits(value: unknown): value is VibeTraits {
  if (!value || typeof value !== "object") return false;
  const traits = value as Partial<VibeTraits>;
  return [traits.spontaneity, traits.social, traits.energy].every(
    (score) => typeof score === "number" && Number.isFinite(score)
  );
}

export default async function VibeRevealPage(
  props: {
    searchParams: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const returnTo = safeRedirectPath(searchParams.returnTo, "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("vibe_persona, vibe_traits, vibe_goal, home_city")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.vibe_persona || !isVibeTraits(profile.vibe_traits)) {
    redirect("/onboarding/vibe-check");
  }

  const { data: recommendations } = profile.home_city
    ? await supabase.rpc("recommended_vibes", { p_limit: 3 })
    : { data: [] as RecommendedVibe[] };
  const recommendedVibes = (recommendations ?? []) as RecommendedVibe[];
  const displayMatches = await loadVibeMatch(
    supabase,
    recommendedVibes.map((vibe) => vibe.id)
  );
  const nearby = recommendedVibes.map((vibe) => ({
    id: vibe.id,
    title: vibe.title,
    startsAt: formatVibeWhen(vibe.starts_at),
    city: vibe.city,
    match: displayMatches[vibe.id],
  }));

  return (
    <main className="mx-auto min-h-dvh max-w-md overflow-hidden">
      <VibeReveal
        initialTraits={profile.vibe_traits}
        goal={profile.vibe_goal}
        nearby={nearby}
        destination={returnTo || "/vibes"}
      />
    </main>
  );
}
