"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Wizard, { type WizardAnswers, type WizardPage } from "@/components/Wizard";
import {
  TRIP_VIBES,
  DEALBREAKERS,
  TRIP_PRIORITIES,
  PRIORITY_MAX,
  MAX_TAGS,
  PACE_CHOICES,
  BUDGET_CHOICES,
  SOCIAL_TRAVEL_CHOICES,
  PLANNING_CHOICES,
  NIGHTLIFE_CHOICES,
  ADVENTURE_CHOICES,
} from "@/lib/vibe-check";

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

// 1..5 scale columns answered via single-tap cards (stored as ints).
const INT_KEYS = ["pace", "budget", "social_energy", "planning", "nightlife", "adventurousness"] as const;

const PAGES: WizardPage[] = [
  { title: "", fields: [{ type: "select", key: "pace", label: "Your natural trip pace?", required: true, options: PACE_CHOICES }] },
  { title: "", fields: [{ type: "select", key: "budget", label: "Your budget vibe on a trip?", required: true, options: BUDGET_CHOICES }] },
  { title: "", fields: [{ type: "select", key: "social_energy", label: "Who do you most want to travel with?", required: true, options: SOCIAL_TRAVEL_CHOICES }] },
  { title: "", fields: [{ type: "select", key: "planning", label: "On a trip, are you a planner?", required: true, options: PLANNING_CHOICES }] },
  { title: "", fields: [{ type: "select", key: "nightlife", label: "Your evenings on a trip?", required: true, options: NIGHTLIFE_CHOICES }] },
  { title: "", fields: [{ type: "select", key: "adventurousness", label: "Weird food, getting lost on purpose?", required: true, options: ADVENTURE_CHOICES }] },
  {
    title: "",
    fields: [
      {
        type: "multi",
        key: "trip_vibe",
        label: "What's the trip really about?",
        hint: `Pick up to ${MAX_TAGS}.`,
        max: MAX_TAGS,
        required: true,
        options: TRIP_VIBES.map((v) => ({ value: v, label: v, emoji: TRIP_VIBE_EMOJI[v] })),
      },
    ],
  },
  {
    title: "",
    fields: [
      {
        type: "multi",
        key: "dealbreakers",
        label: "Any hard preferences?",
        hint: "Used as filters, not just flavor. Skip if none.",
        options: DEALBREAKERS.map((v) => ({ value: v, label: v })),
      },
    ],
  },
  {
    title: "",
    fields: [
      {
        type: "multi",
        key: "match_priorities",
        label: "When we match you, what matters most?",
        hint: `Pick up to ${PRIORITY_MAX}.`,
        max: PRIORITY_MAX,
        required: true,
        options: TRIP_PRIORITIES,
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
      .select("planning, pace, social_energy, budget, nightlife, adventurousness, trip_vibe, dealbreakers, match_priorities")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        // Scale columns come back as ints; the card controls need string values.
        const ints = Object.fromEntries(
          INT_KEYS.map((k) => [k, data?.[k] != null ? String(data[k]) : ""]),
        );
        setInitial({
          ...ints,
          trip_vibe: data?.trip_vibe ?? [],
          dealbreakers: data?.dealbreakers ?? [],
          match_priorities: data?.match_priorities ?? [],
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function complete(a: WizardAnswers) {
    setSaving(true);
    setErr(null);
    const toInt = (v: unknown) => (v === "" || v == null ? null : Number(v));
    const { error } = await supabase
      .from("profiles")
      .update({
        planning: toInt(a.planning),
        pace: toInt(a.pace),
        social_energy: toInt(a.social_energy),
        budget: toInt(a.budget),
        nightlife: toInt(a.nightlife),
        adventurousness: toInt(a.adventurousness),
        trip_vibe: a.trip_vibe ?? [],
        dealbreakers: a.dealbreakers ?? [],
        match_priorities: a.match_priorities ?? [],
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
        title="Travel vibe"
        pages={PAGES}
        initial={initial}
        submitting={saving}
        finishLabel="Save travel vibe"
        flat
        onComplete={complete}
        onClose={onClose}
      />
      {err && (
        <p className="fixed inset-x-0 bottom-3 z-[60] text-center font-nunito text-sm font-bold text-flockie-coral">{err}</p>
      )}
    </>
  );
}
