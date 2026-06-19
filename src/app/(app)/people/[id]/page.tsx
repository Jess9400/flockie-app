import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ProfileView from "@/components/ProfileView";
import ProfileSocials from "@/components/ProfileSocials";
import ProfileReviews, { type ReviewItem } from "@/components/ProfileReviews";
import MatchBackButton from "@/components/MatchBackButton";
import Stars from "@/components/Stars";
import type { Profile } from "@/lib/vibe-check";

export default async function PersonPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "display_name, age, gender, relationship_status, home_city, instagram, x_handle, tiktok, photos, video_url, planning, pace, social_energy, budget, nightlife, adventurousness, trip_vibe, travel_style, dealbreakers, one_liner, activities, activity_skills, activity_social, activity_intensity, activity_vibe, activity_one_liner, onboarding_complete, archetype"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!profile) notFound();

  // Incoming like? (this person liked me and we're not matched yet → match back)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let incomingLike = false;
  if (user && user.id !== params.id) {
    const { data: liked } = await supabase
      .from("buddy_swipes")
      .select("liked")
      .eq("swiper_id", params.id)
      .eq("target_id", user.id)
      .eq("liked", true)
      .maybeSingle();
    if (liked) {
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
  }

  // Reviews
  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at, reviewer_id")
    .eq("subject_id", params.id)
    .order("created_at", { ascending: false });
  const reviews = reviewRows ?? [];
  const reviewerIds = Array.from(new Set(reviews.map((r) => r.reviewer_id)));
  const reviewers: Record<string, { display_name: string | null; photos: string[] | null }> = {};
  if (reviewerIds.length) {
    const { data: rp } = await supabase
      .from("profiles")
      .select("id, display_name, photos")
      .in("id", reviewerIds);
    rp?.forEach((p) => (reviewers[p.id] = { display_name: p.display_name, photos: p.photos }));
  }
  const reviewCount = reviews.length;
  const reviewAvg = reviewCount ? reviews.reduce((s, r) => s + r.rating, 0) / reviewCount : 0;
  const reviewItems: ReviewItem[] = reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at,
    reviewerName: (reviewers[r.reviewer_id]?.display_name || "A flockie").split(" ")[0],
    reviewerPhoto: reviewers[r.reviewer_id]?.photos?.[0] ?? null,
  }));

  return (
    <main className="px-5 pb-10 pt-6">
      <Link href="/match" className="mb-3 flex w-fit items-center gap-1 text-sm font-bold text-muted">
        <ChevronLeft size={16} /> Back
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">
            {profile.display_name || "Flockie"}
            {profile.age ? `, ${profile.age}` : ""}
          </h1>
          {profile.home_city && (
            <p className="mt-0.5 flex items-center gap-1 text-sm font-medium text-muted">
              <MapPin size={14} /> {profile.home_city}
            </p>
          )}
          {reviewCount > 0 && (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-navy">
              <Stars value={reviewAvg} size={14} /> {reviewAvg.toFixed(1)} · {reviewCount} review
              {reviewCount > 1 ? "s" : ""}
            </p>
          )}
        </div>
        <ProfileSocials
          instagram={profile.instagram}
          x_handle={profile.x_handle}
          tiktok={profile.tiktok}
        />
      </div>

      {incomingLike && (
        <MatchBackButton personId={params.id} name={(profile.display_name || "They").split(" ")[0]} />
      )}

      <div className="mt-5">
        <ProfileView profile={profile as Partial<Profile> & { archetype?: string | null }} />
      </div>

      <ProfileReviews avg={reviewAvg} count={reviewCount} items={reviewItems} />
    </main>
  );
}
