"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import TripVibeForm from "@/components/TripVibeForm";
import ActivityVibeForm from "@/components/ActivityVibeForm";
import { profileCompletion } from "@/lib/profile-completion";
import type { Profile } from "@/lib/vibe-check";

// Shown at the top of the public profile (own view). All 3 forms feed back here:
// it reflects overall % and lets you jump straight into the form that's missing.
export default function ProfileCompletion({
  userId,
  profile,
  onEditProfile,
}: {
  userId: string;
  profile: Partial<Profile>;
  onEditProfile: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<"trip" | "activity" | null>(null);
  const { segments, overall } = profileCompletion(profile);

  if (overall >= 100) return null; // nothing to nudge

  function act(key: "profile" | "trip" | "activity") {
    if (key === "profile") onEditProfile();
    else setOpen(key);
  }

  function done() {
    setOpen(null);
    router.refresh();
  }

  return (
    <div className="mb-6 rounded-3xl border-2 border-navy bg-white p-5 font-nunito shadow-[0_4px_0_0_rgba(10,37,69,1)]">
      <div className="flex items-baseline justify-between">
        <p className="font-fredoka text-lg font-bold text-navy">Complete your profile</p>
        <p className="font-fredoka text-lg font-bold text-flockie-coral">{overall}%</p>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full border-2 border-navy bg-cream">
        <div className="h-full rounded-full bg-flockie-coral transition-all" style={{ width: `${overall}%` }} />
      </div>
      <p className="mt-2 text-sm font-medium text-navy/60">A fuller profile means better matches.</p>

      <div className="mt-4 space-y-2">
        {segments.map((s) => {
          const isDone = s.pct >= 100;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => !isDone && act(s.key)}
              disabled={isDone}
              className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition-colors ${
                isDone ? "border-navy/15 bg-cream" : "border-navy bg-white hover:bg-cream"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-navy text-xs font-bold ${
                  isDone ? "bg-flockie-coral text-white" : "bg-cream text-navy"
                }`}
              >
                {isDone ? <Check size={14} strokeWidth={3} /> : `${s.pct}%`}
              </span>
              <span className="flex-1 text-sm font-bold text-navy">{s.label}</span>
              {!isDone && (
                <span className="flex items-center gap-1 text-sm font-bold text-flockie-coral">
                  {s.pct > 0 ? "Finish" : "Add"} <ChevronRight size={15} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {open === "trip" && <TripVibeForm userId={userId} onDone={done} onClose={() => setOpen(null)} />}
      {open === "activity" && <ActivityVibeForm userId={userId} onDone={done} onClose={() => setOpen(null)} />}
    </div>
  );
}
