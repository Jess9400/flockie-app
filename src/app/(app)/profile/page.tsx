import { createClient } from "@/lib/supabase/server";
import ProfileEditor from "@/components/ProfileEditor";
import { type ReviewItem } from "@/components/ProfileReviews";
import type { Profile } from "@/lib/vibe-check";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { compat?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "display_name, age, gender, home_city, instagram, x_handle, tiktok, photos, video_url, planning, pace, social_energy, budget, nightlife, adventurousness, trip_vibe, travel_style, dealbreakers, one_liner, activities, activity_skills, activity_social, activity_intensity, activity_vibe, activity_dealbreakers, activity_one_liner, notifications_enabled, vouch_token, onboarding_complete"
    )
    .eq("id", user!.id)
    .single();

  const complete = profile?.onboarding_complete ?? false;

  // Reviews about me — shown on my own profile too.
  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at, reviewer_id")
    .eq("subject_id", user!.id)
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
    <main className="mx-auto w-full max-w-[720px] px-6 pb-28 pt-6 font-nunito sm:pb-12">
      <ProfileEditor
        userId={user!.id}
        profile={(profile ?? {}) as Partial<Profile>}
        complete={complete}
        reviewAvg={reviewAvg}
        reviewCount={reviewCount}
        reviewItems={reviewItems}
        redirectAfter={searchParams.compat ? `/compat/${searchParams.compat}` : undefined}
      />
    </main>
  );
}
