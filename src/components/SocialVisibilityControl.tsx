"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SocialVisibility = "members" | "connections" | "private";

const OPTIONS: {
  value: SocialVisibility;
  label: string;
  description: string;
}[] = [
  {
    value: "connections",
    label: "Connections",
    description: "People sharing a confirmed plan or buddy match with you.",
  },
  {
    value: "members",
    label: "All members",
    description: "Any signed-in Flockie member viewing your profile.",
  },
  {
    value: "private",
    label: "Only me",
    description: "Social links stay hidden from everyone else.",
  },
];

export default function SocialVisibilityControl({
  userId,
  initial,
}: {
  userId: string;
  initial: SocialVisibility;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: SocialVisibility) {
    if (busy || next === value) return;
    const previous = value;
    setValue(next);
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ social_visibility: next })
      .eq("id", userId);
    setBusy(false);
    if (updateError) {
      setValue(previous);
      setError("Couldn’t update social visibility. Please try again.");
    }
  }

  return (
    <section className="rounded-2xl border-2 border-ink bg-white p-4">
      <h2 className="font-fredoka text-lg font-semibold text-navy">
        Who can see my socials?
      </h2>
      <p className="mt-1 text-xs font-medium leading-relaxed text-muted">
        Your Instagram, X, and TikTok handles never affect matching.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={busy}
              onClick={() => change(option.value)}
              className={`rounded-2xl border-2 p-3 text-left transition-colors disabled:opacity-60 ${
                selected
                  ? "border-ink bg-flockie-blue text-white"
                  : "border-ink/15 bg-[#FCF9F4] text-navy"
              }`}
            >
              <span className="block text-sm font-extrabold">{option.label}</span>
              <span
                className={`mt-1 block text-[11px] font-medium leading-relaxed ${
                  selected ? "text-white/85" : "text-muted"
                }`}
              >
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs font-bold text-red-700">{error}</p>}
    </section>
  );
}
