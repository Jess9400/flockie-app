"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import ProfileStory from "@/components/ProfileStory";
import { type EventsData } from "@/components/ProfileEvents";
import VibeCheckForm from "@/components/VibeCheckForm";
import { type Profile } from "@/lib/vibe-check";

export default function ProfileEditor({
  userId,
  profile,
  complete,
  redirectAfter,
  events,
  takes,
}: {
  userId: string;
  profile: Partial<Profile> & { vibe_goal?: string | null; vibe_persona?: string | null };
  complete: boolean;
  redirectAfter?: string;
  events?: EventsData;
  takes?: { vibe_id: string; body: string; updated_at: string }[];
}) {
  const t = useTranslations("profile");
  // Start in edit mode if the profile isn't complete yet (first-time onboarding).
  const [editing, setEditing] = useState(!complete);

  if (editing) {
    return (
      <div className="mx-auto max-w-[720px] font-nunito">
        {complete && (
          <button
            onClick={() => setEditing(false)}
            className="mb-6 rounded-full border border-navy/15 bg-white px-5 py-2 font-fredoka text-sm font-semibold text-navy"
          >
            {t("editor.cancel")}
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
    <ProfileStory userId={userId} profile={profile} events={events} takes={takes} />
  );
}
