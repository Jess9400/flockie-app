import MatchBackButton from "@/components/MatchBackButton";
import ProfileStory from "@/components/ProfileStory";
import type { EventsData } from "@/components/ProfileEvents";
import type { ProfileStoryReview } from "@/lib/profile-story-reviews";
import type { Profile } from "@/lib/vibe-check";

type PublicProfile = Partial<Profile> & {
  vibe_persona?: string | null;
};

export default function PublicProfileDashboard({
  personId,
  profile,
  events,
  reviews,
  incomingLike,
  socialStrip,
  postsSection,
}: {
  personId: string;
  profile: PublicProfile;
  events?: EventsData;
  reviews?: ProfileStoryReview[];
  socialStrip?: React.ReactNode;
  postsSection?: React.ReactNode;
  incomingLike: boolean;
}) {
  const firstName = (profile.display_name || "there").split(" ")[0];

  return (
    <div>
      <ProfileStory userId={personId} profile={profile} events={events} reviews={reviews} mode="public" socialStrip={socialStrip} postsSection={postsSection} />
      {incomingLike && <MatchBackButton personId={personId} name={firstName} />}
    </div>
  );
}
