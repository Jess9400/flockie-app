"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Wizard, { type WizardAnswers, type WizardPage } from "@/components/Wizard";
import {
  SLIDERS,
  TRIP_VIBES,
  TRAVEL_STYLES,
  DEALBREAKERS,
  MAX_TAGS,
  ONE_LINER_MAX,
  type SliderKey,
} from "@/lib/vibe-check";

// Short end-labels for each slider (the long mid text comes from SLIDERS.scale).
const ENDS: Record<SliderKey, [string, string]> = {
  planning: ["Wing it", "Plan it"],
  pace: ["Slow", "Packed"],
  social_energy: ["Need solo time", "Always social"],
  budget: ["Budget", "Luxury"],
  nightlife: ["Early nights", "All night"],
  adventurousness: ["Familiar", "Adventurous"],
};

const TRIP_VIBE_EMOJI: Record<string, string> = {
  "Chill / wellness / recharge": "🧘",
  "Adventure / outdoors / active": "🏔️",
  "Cultural / history / museums": "🏛️",
  "Foodie / culinary": "🍜",
  "Party / nightlife": "🪩",
  "Beach / coast": "🏖️",
  "Mountains / nature": "⛰️",
  "City exploration": "🌆",
  "Work-friendly / coworking": "💻",
  "Spiritual / retreat": "✨",
};

function slider(key: SliderKey) {
  const s = SLIDERS.find((x) => x.key === key)!;
  return {
    type: "slider" as const,
    key,
    label: s.prompt,
    left: ENDS[key][0],
    right: ENDS[key][1],
    labels: s.scale,
  };
}

const PAGES: WizardPage[] = [
  { title: "How you travel", subtitle: "Plans vs. spontaneity, and your daily rhythm.", fields: [slider("planning"), slider("pace")] },
  { title: "Energy & budget", subtitle: "How social you run, and how you like to spend.", fields: [slider("social_energy"), slider("budget")] },
  { title: "Nights & the unknown", subtitle: "Your evenings, and your appetite for the unfamiliar.", fields: [slider("nightlife"), slider("adventurousness")] },
  {
    title: "Your kind of trip",
    subtitle: `Pick up to ${MAX_TAGS} of each.`,
    fields: [
      {
        type: "multi",
        key: "trip_vibe",
        label: "What kind of trip are you usually after?",
        max: MAX_TAGS,
        required: true,
        options: TRIP_VIBES.map((v) => ({ value: v, label: v, emoji: TRIP_VIBE_EMOJI[v] })),
      },
      {
        type: "multi",
        key: "travel_style",
        label: "Which sound most like you?",
        max: MAX_TAGS,
        options: TRAVEL_STYLES.map((v) => ({ value: v, label: v })),
      },
    ],
  },
  {
    title: "Logistics & you",
    subtitle: "Hard preferences are used as filters. One line to finish.",
    fields: [
      {
        type: "multi",
        key: "dealbreakers",
        label: "Hard preferences",
        options: DEALBREAKERS.map((v) => ({ value: v, label: v })),
      },
      {
        type: "text",
        key: "one_liner",
        label: "Finish: “The kind of travel buddy I am…”",
        placeholder: "…",
        max: ONE_LINER_MAX,
      },
    ],
  },
];

export default function TripVibeForm({
  userId,
  redirectAfter,
  onDone,
  onClose,
}: {
  userId: string;
  redirectAfter?: string;
  onDone?: () => void;
  onClose?: () => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [initial, setInitial] = useState<WizardAnswers | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("planning, pace, social_energy, budget, nightlife, adventurousness, trip_vibe, travel_style, dealbreakers, one_liner")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setInitial({
          planning: data?.planning ?? 3,
          pace: data?.pace ?? 3,
          social_energy: data?.social_energy ?? 3,
          budget: data?.budget ?? 3,
          nightlife: data?.nightlife ?? 3,
          adventurousness: data?.adventurousness ?? 3,
          trip_vibe: data?.trip_vibe ?? [],
          travel_style: data?.travel_style ?? [],
          dealbreakers: data?.dealbreakers ?? [],
          one_liner: data?.one_liner ?? "",
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function complete(a: WizardAnswers) {
    setSaving(true);
    setErr(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        planning: a.planning,
        pace: a.pace,
        social_energy: a.social_energy,
        budget: a.budget,
        nightlife: a.nightlife,
        adventurousness: a.adventurousness,
        trip_vibe: a.trip_vibe ?? [],
        travel_style: a.travel_style ?? [],
        dealbreakers: a.dealbreakers ?? [],
        one_liner: a.one_liner ?? "",
      })
      .eq("id", userId);
    if (error) {
      setSaving(false);
      return setErr(error.message);
    }
    // Separate, migration-safe flag write (column may not exist yet).
    await supabase.from("profiles").update({ trip_prefs_complete: true }).eq("id", userId);
    setSaving(false);
    if (onDone) onDone();
    else if (redirectAfter) router.push(redirectAfter);
    else router.refresh();
  }

  if (!initial) return null;

  return (
    <>
      <Wizard
        title="Trip vibe"
        pages={PAGES}
        initial={initial}
        submitting={saving}
        finishLabel="Save trip vibe"
        onComplete={complete}
        onClose={onClose}
      />
      {err && (
        <p className="fixed inset-x-0 bottom-3 z-[60] text-center font-nunito text-sm font-bold text-flockie-coral">{err}</p>
      )}
    </>
  );
}
