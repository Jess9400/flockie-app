"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Wizard, { type WizardAnswers, type WizardPage } from "@/components/Wizard";
import {
  ACTIVITY_CATEGORIES,
  SKILL_CATEGORIES,
  SKILL_SCALE,
  ACTIVITY_SOCIAL_SCALE,
  INTENSITY_SCALE,
  ACTIVITY_VIBES,
  ACTIVITY_VIBE_MAX,
  ACTIVITY_DEALBREAKERS,
  ACTIVITY_PRIORITIES,
  ACTIVITY_PRIORITY_MAX,
  ONE_LINER_MAX,
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

const PAGES: WizardPage[] = [
  {
    title: "What you're into",
    subtitle: "Pick all that apply, then rate yourself by category.",
    fields: [
      {
        type: "multi",
        key: "activities",
        label: "What do you actually do?",
        required: true,
        options: ACTIVITY_CATEGORIES.flatMap((cat) =>
          cat.items.map((a) => ({ value: a, label: a, group: cat.group })),
        ),
      },
      {
        type: "skills",
        key: "activity_skills",
        label: "Your skill level",
        hint: "Roughly, by category.",
        categories: SKILL_CATEGORIES,
        labels: SKILL_SCALE,
      },
    ],
  },
  {
    title: "How you like it",
    subtitle: "Your style when you show up.",
    fields: [
      { type: "slider", key: "activity_social", label: "Who do you like to do things with?", left: "Solo", right: "Big group", labels: ACTIVITY_SOCIAL_SCALE },
      { type: "slider", key: "activity_intensity", label: "How hard do you want to push?", left: "Pure leisure", right: "All in", labels: INTENSITY_SCALE },
      {
        type: "multi",
        key: "activity_vibe",
        label: "Ideal experience vibe",
        hint: `Pick up to ${ACTIVITY_VIBE_MAX}.`,
        max: ACTIVITY_VIBE_MAX,
        options: ACTIVITY_VIBES.map((v) => ({ value: v, label: v, emoji: ACTIVITY_VIBE_EMOJI[v] })),
      },
      {
        type: "multi",
        key: "activity_dealbreakers",
        label: "Hard preferences",
        options: ACTIVITY_DEALBREAKERS.map((v) => ({ value: v, label: v })),
      },
      {
        type: "text",
        key: "activity_one_liner",
        label: "Finish: “At an activity, I'm the kind of person who…”",
        placeholder: "…",
        max: ONE_LINER_MAX,
      },
    ],
  },
  {
    title: "What matters most",
    subtitle: "We'll weight your meetup matches toward these.",
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
      .select("activities, activity_skills, activity_social, activity_intensity, activity_vibe, activity_dealbreakers, activity_one_liner, activity_priorities")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setInitial({
          activities: data?.activities ?? [],
          activity_skills: data?.activity_skills ?? {},
          activity_social: data?.activity_social ?? 3,
          activity_intensity: data?.activity_intensity ?? 3,
          activity_vibe: data?.activity_vibe ?? [],
          activity_dealbreakers: data?.activity_dealbreakers ?? [],
          activity_one_liner: data?.activity_one_liner ?? "",
          activity_priorities: data?.activity_priorities ?? [],
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
        activities: a.activities ?? [],
        activity_skills: a.activity_skills ?? {},
        activity_social: a.activity_social,
        activity_intensity: a.activity_intensity,
        activity_vibe: a.activity_vibe ?? [],
        activity_dealbreakers: a.activity_dealbreakers ?? [],
        activity_one_liner: a.activity_one_liner ?? "",
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
        title="Activity vibe"
        pages={PAGES}
        initial={initial}
        submitting={saving}
        finishLabel="Save activity vibe"
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
