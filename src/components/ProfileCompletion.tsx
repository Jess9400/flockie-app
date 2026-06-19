"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import TripVibeForm from "@/components/TripVibeForm";
import ActivityVibeForm from "@/components/ActivityVibeForm";
import { profileCompletion, type CompletionInput } from "@/lib/profile-completion";

// Top of the public profile (own view). All 3 forms feed back here: it shows
// overall % and a tab per form. Every tab is tappable — completed ones reopen
// their form so you can edit what you filled.
export default function ProfileCompletion({
  userId,
  profile,
  onEditProfile,
}: {
  userId: string;
  profile: CompletionInput;
  onEditProfile: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<"trip" | "activity" | null>(null);
  const { segments, overall } = profileCompletion(profile);
  const allDone = overall >= 100;

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
      <div className="flex items-center justify-between">
        <p className="font-fredoka text-lg font-bold text-navy">
          {allDone ? "Your profile" : "Complete your profile"}
        </p>
        <p className="font-fredoka text-xl font-bold text-flockie-coral">{overall}%</p>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full border-2 border-navy bg-cream">
        <div className="h-full rounded-full bg-flockie-coral transition-all" style={{ width: `${overall}%` }} />
      </div>
      <p className="mt-2 text-sm font-medium text-navy/60">
        {allDone ? "All set — tap a tab to edit." : "A fuller profile means better matches."}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {segments.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => act(s.key)}
            className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center transition-colors ${
              s.done ? "border-flockie-coral bg-flockie-coral/10" : "border-navy bg-white hover:bg-cream"
            }`}
          >
            {s.done ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-flockie-coral text-white">
                <Check size={16} strokeWidth={3} />
              </span>
            ) : (
              <span className="flex h-8 items-center font-fredoka text-lg font-bold text-navy">{s.pct}%</span>
            )}
            <span className="text-[13px] font-bold leading-tight text-navy">{s.label}</span>
            <span className={`text-[11px] font-bold ${s.done ? "text-flockie-coral/70" : "text-flockie-coral"}`}>
              {s.done ? "Edit" : s.pct > 0 ? "Finish" : "Add"}
            </span>
          </button>
        ))}
      </div>

      {open === "trip" && <TripVibeForm userId={userId} onDone={done} onClose={() => setOpen(null)} />}
      {open === "activity" && <ActivityVibeForm userId={userId} onDone={done} onClose={() => setOpen(null)} />}
    </div>
  );
}
