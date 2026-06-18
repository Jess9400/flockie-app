import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SwipeDeck from "@/components/SwipeDeck";

const CITY_THRESHOLD = 99; // need MORE than this many profiles in a city

export default async function MatchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete, home_city, activities")
    .eq("id", user!.id)
    .maybeSingle();

  const complete =
    !!profile?.onboarding_complete && (profile?.activities ?? []).length > 0;
  const city = profile?.home_city?.trim() || "";

  // Determine what to show in the Buddy lane
  let body: React.ReactNode;

  if (!complete) {
    body = (
      <Gate
        title="Finish your vibe check first 🪶"
        text="We match you on your vibe-check answers. Complete it to start swiping."
        cta="Complete my vibe check"
      />
    );
  } else if (!city) {
    body = (
      <Gate
        title="Add your city"
        text="Set your home city in your profile so we can find people near you."
        cta="Add my city"
      />
    );
  } else {
    const { data: count } = await supabase.rpc("buddy_city_count");
    if ((count ?? 0) <= CITY_THRESHOLD) {
      body = (
        <div className="mt-6 rounded-3xl border-2 border-ink bg-white p-8 text-center shadow-[0_5px_0_0_rgba(26,26,26,1)]">
          <p className="text-3xl">🌍</p>
          <p className="mt-3 text-lg font-extrabold">
            Matching isn&rsquo;t live in {city} yet
          </p>
          <p className="mt-2 font-medium text-ink/70">
            We&rsquo;re still gathering flockies in your city. We&rsquo;ll notify
            you the moment buddy matching opens in {city}. In the meantime,
            create or join a Vibe.
          </p>
          <Link
            href="/vibes"
            className="mt-5 inline-block rounded-full border-2 border-ink bg-flockie-orange px-5 py-2.5 font-bold text-white shadow-[0_4px_0_0_#E0512C]"
          >
            Explore Vibes
          </Link>
        </div>
      );
    } else {
      const { data: candidates } = await supabase.rpc("buddy_candidates", {
        p_limit: 30,
      });
      body = <SwipeDeck candidates={candidates ?? []} />;
    }
  }

  return (
    <main className="px-5 pb-10 pt-6">
      <h1 className="text-2xl font-black">Find a match</h1>
      <p className="mt-1 text-sm font-medium text-muted">
        Swipe vibe-matched people for your next trip. Matches are scored on your
        vibe check, never random.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-full border-2 border-ink bg-white p-1 text-sm font-bold">
        <span className="rounded-full bg-flockie-orange py-2 text-center text-white">
          Find a Buddy
        </span>
        <Link href="/vibes" className="rounded-full py-2 text-center text-ink">
          Find a Flock
        </Link>
      </div>

      {body}
    </main>
  );
}

function Gate({ title, text, cta }: { title: string; text: string; cta: string }) {
  return (
    <div className="mt-6 rounded-3xl border-2 border-ink bg-white p-8 text-center shadow-[0_5px_0_0_rgba(26,26,26,1)]">
      <p className="text-lg font-extrabold">{title}</p>
      <p className="mt-2 font-medium text-ink/70">{text}</p>
      <Link
        href="/profile"
        className="mt-5 inline-block rounded-full border-2 border-ink bg-flockie-orange px-5 py-2.5 font-bold text-white shadow-[0_4px_0_0_#E0512C]"
      >
        {cta}
      </Link>
    </div>
  );
}
