import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import CreateVibeForm from "@/components/CreateVibeForm";
import ActivityVibeForm from "@/components/ActivityVibeForm";

export default async function NewVibePage({
  searchParams,
}: {
  searchParams: { activity?: string; city?: string; title?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
      <h1 className="text-2xl font-black">Create a Vibe</h1>
      <p className="mt-1 text-sm font-medium text-muted">
        A curated <span className="font-bold">group</span> room — attendees are
        matched by vibe, not first-come. No swiping.
      </p>
      <div className="mt-6">
        <CreateVibeForm
          userId={user!.id}
          defaultCity={searchParams.city ?? profile?.home_city ?? ""}
          defaultActivityUrl={searchParams.activity ?? ""}
          defaultTitle={searchParams.title ?? ""}
        />
      </div>
    </main>
  );
}
