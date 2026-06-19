"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Settings, Share2 } from "lucide-react";
import ProfileView from "@/components/ProfileView";
import ProfileCompletion from "@/components/ProfileCompletion";
import ProfileReviews, { type ReviewItem } from "@/components/ProfileReviews";
import VibeCheckForm from "@/components/VibeCheckForm";
import VibeShareCard from "@/components/VibeShareCard";
import CompatShareButton from "@/components/CompatShareButton";
import type { Profile } from "@/lib/vibe-check";

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
  const shareTags = [
    ...(profile.trip_vibe ?? []),
    ...(profile.travel_style ?? []),
    ...(profile.activity_vibe ?? []),
  ];

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

      <ProfileCompletion userId={userId} profile={profile} onEditProfile={() => setEditing(true)} />

      <ProfileView profile={profile} />

      <ProfileReviews avg={reviewAvg} count={reviewCount} items={reviewItems} />

      {/* Invite a friend to see their match % with you */}
      <div className="mt-8 flex justify-center">
        <CompatShareButton userId={userId} />
      </div>

      {/* Edit CTA — fixed bottom-right desktop, sticky bottom-center mobile */}
      <button
        onClick={() => setEditing(true)}
        className="fixed bottom-4 left-1/2 z-30 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border-2 border-navy bg-flockie-coral px-6 py-3 font-fredoka text-base font-semibold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)] sm:bottom-6 sm:right-6 sm:left-auto sm:translate-x-0"
      >
        <Pencil size={16} /> Edit profile
      </button>

      {showShare && (
        <VibeShareCard
          userId={userId}
          name={profile.display_name ?? ""}
          tags={shareTags}
          archetypeKey={(profile as { archetype?: string | null }).archetype}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
