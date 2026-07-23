import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import CreateVibeForm from "@/components/CreateVibeForm";
import ActivityVibeForm from "@/components/ActivityVibeForm";

export default async function NewVibePage({
  searchParams,
}: {
    searchParams: { activity?: string; city?: string; title?: string; from?: string; club?: string };
}) {
  const supabase = await createClient();
  const user = await getSessionUser();
  const t = await getTranslations("vibes");

  // A linked gathering is only created by the Club owner. The database trigger
  // in clubs-foundation.sql enforces the same rule, so a forged URL cannot
  // attach a Vibe to someone else’s Club.
  let club: { id: string; title: string; city: string } | null = null;
  if (searchParams.club) {
    const { data } = await supabase
      .from("clubs")
      .select("id, title, city")
      .eq("id", searchParams.club)
      .eq("owner_id", user!.id)
      .maybeSingle();
    club = data;
  }

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
        country: src.country ?? "",
        city: src.city ?? "",
        area: src.area ?? "",
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
        <ChevronLeft size={16} /> {t("create.back")}
      </Link>
      <h1 className="text-2xl font-black">
        {club ? t("create.titleClubGathering") : clone ? t("create.titleRunAgain") : t("create.titleCreate")}
      </h1>
      <p className="mt-1 text-sm font-medium text-muted">
        {club ? t("create.subtitleClubGathering", { club: club.title }) : clone ? t("create.subtitleRunAgain") : t("create.subtitleCreate")}
      </p>
      <div className="mt-6">
        <CreateVibeForm
          userId={user!.id}
          defaultCity={searchParams.city ?? club?.city ?? ""}
          defaultActivityUrl={searchParams.activity ?? ""}
          defaultTitle={searchParams.title ?? ""}
          clone={clone}
          clubId={club?.id}
        />
      </div>
    </main>
  );
}
