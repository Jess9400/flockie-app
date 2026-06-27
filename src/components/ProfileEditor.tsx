"use client";

import { useState } from "react";
import OwnerProfileDashboard from "@/components/OwnerProfileDashboard";
import { type ReviewItem } from "@/components/ProfileReviews";
import { type EventsData } from "@/components/ProfileEvents";
import VibeCheckForm from "@/components/VibeCheckForm";
import VibeShareCard from "@/components/VibeShareCard";
import VibeCompletePopup from "@/components/VibeCompletePopup";
import { topVibeTags, type Profile } from "@/lib/vibe-check";

export default function ProfileEditor({
  userId,
  profile,
  complete,
  reviewCount = 0,
  reviewItems = [],
  redirectAfter,
  celebrate,
  stats,
  events,
}: {
  userId: string;
  profile: Partial<Profile>;
  complete: boolean;
  reviewCount?: number;
  reviewItems?: ReviewItem[];
  redirectAfter?: string;
  celebrate?: boolean;
  stats?: Record<string, number>;
  events?: EventsData;
}) {
  // Start in edit mode if the profile isn't complete yet (first-time onboarding).
  const [editing, setEditing] = useState(!complete);
  const [showShare, setShowShare] = useState(false);
  const shareTags = topVibeTags(profile);
  const ext = profile as {
    archetype?: string | null;
    trip_prefs_complete?: boolean | null;
    activity_prefs_complete?: boolean | null;
  };
  const allComplete = !!(
    profile.display_name &&
    (profile.photos?.length ?? 0) > 0 &&
    ext.archetype &&
    ext.trip_prefs_complete &&
    ext.activity_prefs_complete
  );

  if (editing) {
    return (
      <div className="mx-auto max-w-[720px] font-nunito">
        {complete && (
          <button
            onClick={() => setEditing(false)}
            className="mb-6 rounded-full border-2 border-navy bg-white px-5 py-2 font-fredoka text-sm font-semibold text-navy"
          >
            Cancel
          </button>
        )}
        <VibeCheckForm
          userId={userId}
          initial={profile}
          onSaved={() => setEditing(false)}
          redirectAfter={redirectAfter}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <OwnerProfileDashboard
        userId={userId}
        profile={profile}
        reviewCount={reviewCount}
        reviewItems={reviewItems}
        onEditProfile={() => setEditing(true)}
        onShare={() => setShowShare(true)}
        stats={stats}
        events={events}
      />

      {showShare && (
        <VibeShareCard
          userId={userId}
          name={profile.display_name ?? ""}
          tags={shareTags}
          archetypeKey={ext.archetype}
          onClose={() => setShowShare(false)}
        />
      )}

      <VibeCompletePopup
        userId={userId}
        name={profile.display_name ?? ""}
        tags={shareTags}
        archetypeKey={ext.archetype}
        allComplete={allComplete}
        force={celebrate}
      />
    </div>
  );
}
