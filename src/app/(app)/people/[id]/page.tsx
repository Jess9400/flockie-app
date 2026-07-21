import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import PublicProfileDashboard from "@/components/PublicProfileDashboard";
import { type EventsData } from "@/components/ProfileEvents";
import type { Profile } from "@/lib/vibe-check";

export default async function PersonPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const t = await getTranslations("profile");

  // The public story is intentionally small: privacy-safe profile details and
  // completed Vibes only. The event RPC hides future plans from visitors.
  const [{ data: profile }, user, { data: eventsData }] = await Promise.all([
    supabase
      .from("public_profiles")
      .select(
        "display_name, age, home_city, photos, bio, vibe_persona"
      )
      .eq("id", params.id)
      .maybeSingle(),
    getSessionUser(),
    supabase.rpc("public_profile_events", { p_user: params.id }),
  ]);

  if (!profile) notFound();

  // Incoming like? (this person liked me and we're not matched yet → match back)
  const { data: liked } = user && user.id !== params.id
    ? await supabase
      .from("buddy_swipes")
      .select("liked")
      .eq("swiper_id", params.id)
      .eq("target_id", user.id)
      .eq("liked", true)
      .maybeSingle()
    : { data: null };

  let incomingLike = false;
  if (user && user.id !== params.id && liked) {
    const a = user.id < params.id ? user.id : params.id;
    const b = user.id < params.id ? params.id : user.id;
    const { data: m } = await supabase
      .from("buddy_matches")
      .select("id")
      .eq("user_a", a)
      .eq("user_b", b)
      .maybeSingle();
    incomingLike = !m;
  }

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-6 font-nunito sm:px-6 sm:pb-12">
      <Link href="/match" className="mb-3 flex w-fit items-center gap-1 text-sm font-bold text-muted">
        <ChevronLeft size={16} /> {t("page.back")}
      </Link>

      <PublicProfileDashboard
        personId={params.id}
        profile={profile as Partial<Profile> & { vibe_persona?: string | null }}
        events={(eventsData ?? {}) as EventsData}
        incomingLike={incomingLike}
      />
    </main>
  );
}
