import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import CreateVibeForm from "@/components/CreateVibeForm";
import ActivityVibeForm from "@/components/ActivityVibeForm";

export default async function NewVibePage({
  searchParams,
}: {
  searchParams: { activity?: string; city?: string; title?: string; from?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // "Run it again": pre-fill from one of my past vibes (dates left blank to re-set).
  let clone: Parameters<typeof CreateVibeForm>[0]["clone"];
  if (searchParams.from) {
    const { data: src } = await supabase
      .from("vibes")
      .select("*")
      .eq("id", searchParams.from)
      .eq("host_id", user!.id)
      .maybeSingle();
    if (src) {
      clone = {
        title: src.title,
        description: src.description ?? "",
        category: src.category ?? "",
        activityUrl: src.activity_url ?? "",
        photos: src.photos ?? [],
        city: src.city ?? "",
        locationName: src.location_name ?? "",
        capacity: src.capacity ?? 10,
        genderPref: src.gender_pref ?? "any",
        algoShare: src.algo_share ?? 100,
        whatToBring: src.what_to_bring ?? "",
        language: src.language ?? "",
        ageMin: src.age_min ?? 18,
        ageMax: src.age_max ?? 99,
        skill: src.required_skill_level ?? null,
        tags: src.event_vibe_tags ?? [],
        rules: (src.dealbreaker_rules ?? {}) as Record<string, boolean>,
        diversity: src.diversity_floor_enabled ?? false,
      };
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("home_city")
    .eq("id", user!.id)
    .single();

  // Activity vibe gate (migration-safe: degrade open if column missing).
  const { data: prefs, error: prefsErr } = await supabase
    .from("profiles")
    .select("activity_prefs_complete")
    .eq("id", user!.id)
    .maybeSingle();
  const activityPrefsDone = prefsErr ? true : !!prefs?.activity_prefs_complete;
  if (!activityPrefsDone) {
    return <ActivityVibeForm userId={user!.id} redirectAfter="/vibes/new" />;
  }

  return (
    <main className="px-5 pt-6">
      <Link
        href="/vibes"
        className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-muted"
      >
        <ChevronLeft size={16} /> Back
      </Link>
      <h1 className="text-2xl font-black">{clone ? "Run it again" : "Create a Vibe"}</h1>
      <p className="mt-1 text-sm font-medium text-muted">
        {clone
          ? "Same details, fresh date — set a new start, deadline and spots, then publish."
          : "A curated group room — attendees are matched by vibe, not first-come. No swiping."}
      </p>
      <div className="mt-6">
        <CreateVibeForm
          userId={user!.id}
          defaultCity={searchParams.city ?? profile?.home_city ?? ""}
          defaultActivityUrl={searchParams.activity ?? ""}
          defaultTitle={searchParams.title ?? ""}
          clone={clone}
        />
      </div>
    </main>
  );
}
