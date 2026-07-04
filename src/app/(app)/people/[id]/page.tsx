import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import PublicProfileDashboard from "@/components/PublicProfileDashboard";
import { type EventsData } from "@/components/ProfileEvents";
import { type ReviewItem } from "@/components/ProfileReviews";
import type { Profile } from "@/lib/vibe-check";

export default async function PersonPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const t = await getTranslations("profile");

  // Profile, viewer, reviews, and the two social-proof RPCs are independent —
  // everything except the reviewer/like follow-ups keys on params.id alone.
  const [
    { data: profile },
    user,
    { data: reviewRows },
    { data: statsData },
    { data: eventsData },
  ] = await Promise.all([
    supabase
      .from("public_profiles")
      .select(
        "display_name, age, home_city, instagram, x_handle, tiktok, photos, video_url, bio, trip_vibe, one_liner, activities, activity_vibe, archetype"
      )
      .eq("id", params.id)
      .maybeSingle(),
    getSessionUser(),
    supabase
      .from("reviews")
      .select("id, rating, comment, created_at, reviewer_id")
      .eq("subject_id", params.id)
      .order("created_at", { ascending: false }),
    supabase.rpc("public_profile_stats", { p_user: params.id }),
    supabase.rpc("public_profile_events", { p_user: params.id }),
  ]);

  if (!profile) notFound();

  const reviews = reviewRows ?? [];
  const reviewerIds = Array.from(new Set(reviews.map((r) => r.reviewer_id)));

  // Incoming like? (this person liked me and we're not matched yet → match back)
  // + reviewer profiles — both follow-ups, independent of each other.
  const [{ data: liked }, { data: rp }] = await Promise.all([
    user && user.id !== params.id
      ? supabase
          .from("buddy_swipes")
          .select("liked")
          .eq("swiper_id", params.id)
          .eq("target_id", user.id)
          .eq("liked", true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    reviewerIds.length
      ? supabase.from("public_profiles").select("id, display_name, photos").in("id", reviewerIds)
      : Promise.resolve({ data: null }),
  ]);

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

  const reviewers: Record<string, { display_name: string | null; photos: string[] | null }> = {};
  rp?.forEach((p) => (reviewers[p.id] = { display_name: p.display_name, photos: p.photos }));
  const reviewItems: ReviewItem[] = reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at,
    reviewerName: (reviewers[r.reviewer_id]?.display_name || t("reviewerFallback")).split(" ")[0],
    reviewerPhoto: reviewers[r.reviewer_id]?.photos?.[0] ?? null,
  }));

  // Social proof: activity across Vibes, Activities, Trips & Flocks (all cities).
  const stats = (statsData ?? {}) as Record<string, number>;

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-6 font-nunito sm:px-6 sm:pb-12">
      <Link href="/match" className="mb-3 flex w-fit items-center gap-1 text-sm font-bold text-muted">
        <ChevronLeft size={16} /> {t("page.back")}
      </Link>

      <PublicProfileDashboard
        personId={params.id}
        profile={profile as Partial<Profile> & { archetype?: string | null }}
        reviewItems={reviewItems}
        stats={stats}
        events={(eventsData ?? {}) as EventsData}
        incomingLike={incomingLike}
      />
    </main>
  );
}
