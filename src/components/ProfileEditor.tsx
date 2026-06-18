"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
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
      <div>
        {complete && (
          <button
            onClick={() => setEditing(false)}
            className="mb-4 rounded-full border-2 border-ink bg-white px-4 py-1.5 text-sm font-bold"
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
    <div>
      <button
        onClick={() => setEditing(true)}
        className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-flockie-orange px-5 py-2 font-bold text-white shadow-[0_3px_0_0_#E0512C]"
      >
        <Pencil size={16} /> Edit profile
      </button>
      <ProfileView profile={profile} />
    </div>
  );
}
