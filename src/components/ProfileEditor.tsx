"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Settings } from "lucide-react";
import ProfileView from "@/components/ProfileView";
import VibeCheckForm from "@/components/VibeCheckForm";
import type { Profile } from "@/lib/vibe-check";

export default function ProfileEditor({
  userId,
  profile,
  complete,
}: {
  userId: string;
  profile: Partial<Profile>;
  complete: boolean;
}) {
  // Start in edit mode if the profile isn't complete yet (first-time onboarding).
  const [editing, setEditing] = useState(!complete);

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
        />
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Settings gear — top-right overlay */}
      <Link
        href="/settings"
        aria-label="Settings"
        className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-navy bg-white/90 text-navy backdrop-blur hover:bg-white"
      >
        <Settings size={18} />
      </Link>

      <ProfileView profile={profile} />

      {/* Edit CTA — fixed bottom-right desktop, sticky bottom-center mobile */}
      <button
        onClick={() => setEditing(true)}
        className="fixed bottom-4 left-1/2 z-30 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border-2 border-navy bg-flockie-coral px-6 py-3 font-fredoka text-base font-semibold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)] sm:bottom-6 sm:right-6 sm:left-auto sm:translate-x-0"
      >
        <Pencil size={16} /> Edit profile
      </button>
    </div>
  );
}
