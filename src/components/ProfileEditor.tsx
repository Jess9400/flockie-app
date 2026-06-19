"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings, Share2 } from "lucide-react";
import ProfileTabs from "@/components/ProfileTabs";
import { type ReviewItem } from "@/components/ProfileReviews";
import VibeCheckForm from "@/components/VibeCheckForm";
import VibeShareCard from "@/components/VibeShareCard";
import VibeCompletePopup from "@/components/VibeCompletePopup";
import { topVibeTags, type Profile } from "@/lib/vibe-check";

export default function ProfileEditor({
  userId,
  profile,
  complete,
  reviewAvg = 0,
  reviewCount = 0,
  reviewItems = [],
  redirectAfter,
}: {
  userId: string;
  profile: Partial<Profile>;
  complete: boolean;
  reviewAvg?: number;
  reviewCount?: number;
  reviewItems?: ReviewItem[];
  redirectAfter?: string;
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
      <div className="font-nunito">
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
      {/* Top-right overlay controls */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowShare(true)}
          aria-label="Share my vibe"
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-navy bg-white/90 text-navy backdrop-blur hover:bg-white"
        >
          <Share2 size={18} />
        </button>
        <Link
          href="/settings"
          aria-label="Settings"
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-navy bg-white/90 text-navy backdrop-blur hover:bg-white"
        >
          <Settings size={18} />
        </Link>
      </div>

      <div className="pt-14">
        <ProfileTabs
          userId={userId}
          profile={profile}
          reviewAvg={reviewAvg}
          reviewCount={reviewCount}
          reviewItems={reviewItems}
          onEditProfile={() => setEditing(true)}
        />
      </div>

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
      />
    </div>
  );
}
