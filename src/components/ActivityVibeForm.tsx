"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Wizard, { type WizardAnswers, type WizardPage } from "@/components/Wizard";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_VIBES,
  ACTIVITY_VIBE_MAX,
  ACTIVITY_DEALBREAKERS,
  ACTIVITY_PRIORITIES,
  ACTIVITY_PRIORITY_MAX,
  ACTIVITY_SOCIAL_CHOICES,
  ACTIVITY_INTENSITY_CHOICES,
  SOCIAL_STYLE_CHOICES,
  MOTIVATION_CHOICES,
  INITIATOR_CHOICES,
} from "@/lib/vibe-check";

const ACTIVITY_VIBE_EMOJI: Record<string, string> = {
  "Quiet, focused, no chitchat": "🤫",
  "Social, lots of conversation": "💬",
  "Competitive / goal-oriented": "🏆",
  "Creative / open-ended": "🎨",
  "Spiritual / contemplative": "🕯️",
  "Party / energetic / loud": "🎉",
  "Educational / structured": "📚",
};

// 1..5 scale columns answered via single-tap cards (stored as ints).
const INT_KEYS = ["activity_social", "activity_intensity", "social_style"] as const;
// Category-token columns stored as text.
const TEXT_KEYS = ["activity_motivation", "initiator"] as const;

const PAGES: WizardPage[] = [
  {
    title: "",
    fields: [
      {
        type: "multi",
        key: "activities",
        label: "What do you actually do?",
        hint: "Your top few — no need to pick everything.",
        max: 6,
        required: true,
        options: ACTIVITY_CATEGORIES.flatMap((cat) =>
          cat.items.map((a) => ({ value: a, label: a, group: cat.group })),
        ),
      },
    ],
  },
  {
    title: "",
    fields: [
      {
        type: "select",
        key: "activity_motivation",
        label: "What pulls you out of the house?",
        hint: "The thing you're really after when you go to a local plan.",
        required: true,
        options: MOTIVATION_CHOICES,
      },
    ],
  },
  { title: "", fields: [{ type: "select", key: "activity_social", label: "Ideal group size for a meetup?", required: true, options: ACTIVITY_SOCIAL_CHOICES }] },
  { title: "", fields: [{ type: "select", key: "social_style", label: "Walking into a room of strangers, you…", required: true, options: SOCIAL_STYLE_CHOICES }] },
  { title: "", fields: [{ type: "select", key: "activity_intensity", label: "How hard do you want to push?", required: true, options: ACTIVITY_INTENSITY_CHOICES }] },
  { title: "", fields: [{ type: "select", key: "initiator", label: "Are you more the one who…", required: true, options: INITIATOR_CHOICES }] },
  {
    title: "",
    fields: [
      {
        type: "multi",
        key: "activity_vibe",
        label: "Ideal experience vibe",
        hint: `Pick up to ${ACTIVITY_VIBE_MAX}.`,
        max: ACTIVITY_VIBE_MAX,
        options: ACTIVITY_VIBES.map((v) => ({ value: v, label: v, emoji: ACTIVITY_VIBE_EMOJI[v] })),
      },
    ],
  },
  {
    title: "",
    fields: [
      {
        type: "multi",
        key: "activity_dealbreakers",
        label: "Any hard preferences?",
        hint: "Used as filters. Skip if none.",
        options: ACTIVITY_DEALBREAKERS.map((v) => ({ value: v, label: v })),
      },
    ],
  },
  {
    title: "",
    fields: [
      {
        type: "multi",
        key: "activity_priorities",
        label: "For a meetup, what matters most?",
        hint: `Pick up to ${ACTIVITY_PRIORITY_MAX}.`,
        max: ACTIVITY_PRIORITY_MAX,
        required: true,
        options: ACTIVITY_PRIORITIES,
      },
    ],
  },
];

export default function ActivityVibeForm({
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
      .select("activities, activity_social, activity_intensity, social_style, activity_motivation, initiator, activity_vibe, activity_dealbreakers, activity_priorities")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        const ints = Object.fromEntries(
          INT_KEYS.map((k) => [k, data?.[k] != null ? String(data[k]) : ""]),
        );
        const texts = Object.fromEntries(TEXT_KEYS.map((k) => [k, data?.[k] ?? ""]));
        setInitial({
          ...ints,
          ...texts,
          activities: data?.activities ?? [],
          activity_vibe: data?.activity_vibe ?? [],
          activity_dealbreakers: data?.activity_dealbreakers ?? [],
          activity_priorities: data?.activity_priorities ?? [],
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
        activities: a.activities ?? [],
        activity_social: toInt(a.activity_social),
        activity_intensity: toInt(a.activity_intensity),
        social_style: toInt(a.social_style),
        activity_motivation: (a.activity_motivation as string) || null,
        initiator: (a.initiator as string) || null,
        activity_vibe: a.activity_vibe ?? [],
        activity_dealbreakers: a.activity_dealbreakers ?? [],
        activity_priorities: a.activity_priorities ?? [],
      })
      .eq("id", userId);
    if (error) {
      setSaving(false);
      return setErr(error.message);
    }
    await supabase.from("profiles").update({ activity_prefs_complete: true }).eq("id", userId);
    setSaving(false);
    if (onDone) onDone();
    else if (redirectAfter) router.push(redirectAfter);
    else router.refresh();
  }

  if (!initial) return null;

  return (
    <>
      <Wizard
        title="Event vibe"
        pages={PAGES}
        initial={initial}
        submitting={saving}
        finishLabel="Save event vibe"
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
