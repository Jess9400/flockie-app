import Link from "next/link";
import BackLink from "@/components/BackLink";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import PublicProfileDashboard from "@/components/PublicProfileDashboard";
import { type EventsData } from "@/components/ProfileEvents";
import type { Profile } from "@/lib/vibe-check";
import { getProfileStoryReviews } from "@/lib/profile-story-reviews";
import ProfileSocialStrip from "@/components/ProfileSocialStrip";
import FeedSection, { type FeedPost } from "@/components/FeedSection";

export default async function PersonPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const t = await getTranslations("profile");
  const tFeed = await getTranslations("feed");

  // The public story is intentionally small: privacy-safe profile details and
  // completed Vibes only. The event RPC hides future plans from visitors.
  const [{ data: profile }, user, { data: eventsData }, storyReviews] = await Promise.all([
    supabase
      .from("public_profiles")
      .select(
        "display_name, age, home_city, photos, bio, vibe_persona"
      )
      .eq("id", params.id)
      .maybeSingle(),
    getSessionUser(),
    supabase.rpc("public_profile_events", { p_user: params.id }),
    getProfileStoryReviews(params.id),
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

  // Social layer — migration-safe (empty before feed/follows SQL runs).
  const [personPostsRes, followingRes, followersRes, viewerFollowRes] = await Promise.all([
    supabase.rpc("user_posts", { p_user: params.id, p_limit: 8 }),
    supabase.from("follows").select("followee_id", { count: "exact", head: true }).eq("follower_id", params.id),
    supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", params.id),
    user
      ? supabase.from("follows").select("followee_id").eq("follower_id", user.id).eq("followee_id", params.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const personPosts = personPostsRes.error ? [] : ((personPostsRes.data ?? []) as FeedPost[]);

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-6 font-nunito sm:px-6 sm:pb-12">
      <BackLink label={t("page.back")} fallback="/match" />

      <PublicProfileDashboard
        personId={params.id}
        profile={profile as Partial<Profile> & { vibe_persona?: string | null }}
        events={(eventsData ?? {}) as EventsData}
        reviews={storyReviews}
        incomingLike={incomingLike}
        socialStrip={
          <ProfileSocialStrip
            userId={params.id}
            isOwner={false}
            posts={personPosts.length}
            following={followingRes.count ?? 0}
            followers={followersRes.count ?? 0}
            viewerFollows={!!viewerFollowRes.data}
          />
        }
        postsSection={
          personPosts.length > 0 && user ? (
            <section className="mt-8">
              <h2 className="px-1 font-fredoka text-xl font-bold text-navy">{tFeed("social.postsHeading")}</h2>
              <div className="mx-auto mt-3 max-w-xl lg:mx-0">
                <FeedSection posts={personPosts} meId={user.id} mePhoto={null} composer={false} />
              </div>
            </section>
          ) : null
        }
      />
    </main>
  );
}
