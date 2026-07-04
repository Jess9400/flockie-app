"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import Wizard, { type WizardAnswers, type WizardPage } from "@/components/Wizard";
import { useToast } from "@/components/ui/feedback";
import { ARCHETYPES } from "@/lib/onboarding/archetypes";
import { recomputeDisplayedVibe } from "@/lib/onboarding/vibe-actions";
import type { VibeDimension } from "@/lib/onboarding/types";
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
  type Choice,
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
  const toast = useToast();
  const t = useTranslations("vibeCheck");
  const [initial, setInitial] = useState<WizardAnswers | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Resolve a data-driven label, falling back to the lib's raw English text so
  // any unmapped/custom value still renders.
  const has = (key: string) => t.has(key);
  const localizeChoices = (set: string, choices: Choice[]) =>
    choices.map((o) => ({ ...o, label: has(`choices.${set}.${o.value}`) ? t(`choices.${set}.${o.value}`) : o.label }));

  const pages: WizardPage[] = [
    {
      title: "",
      fields: [
        {
          type: "multi",
          key: "activities",
          label: t("forms.activity.activitiesLabel"),
          hint: t("forms.activity.activitiesHint"),
          max: 6,
          required: true,
          options: ACTIVITY_CATEGORIES.flatMap((cat) =>
            cat.items.map((a) => ({
              value: a,
              label: has(`activities.${a}`) ? t(`activities.${a}`) : a,
              group: has(`activityGroups.${cat.group}`) ? t(`activityGroups.${cat.group}`) : cat.group,
            })),
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
          label: t("forms.activity.motivationLabel"),
          hint: t("forms.activity.motivationHint"),
          required: true,
          options: localizeChoices("motivation", MOTIVATION_CHOICES),
        },
      ],
    },
    { title: "", fields: [{ type: "select", key: "activity_social", label: t("forms.activity.social"), required: true, options: localizeChoices("activitySocial", ACTIVITY_SOCIAL_CHOICES) }] },
    { title: "", fields: [{ type: "select", key: "social_style", label: t("forms.activity.socialStyle"), required: true, options: localizeChoices("socialStyle", SOCIAL_STYLE_CHOICES) }] },
    { title: "", fields: [{ type: "select", key: "activity_intensity", label: t("forms.activity.intensity"), required: true, options: localizeChoices("activityIntensity", ACTIVITY_INTENSITY_CHOICES) }] },
    { title: "", fields: [{ type: "select", key: "initiator", label: t("forms.activity.initiator"), required: true, options: localizeChoices("initiator", INITIATOR_CHOICES) }] },
    {
      title: "",
      fields: [
        {
          type: "multi",
          key: "activity_vibe",
          label: t("forms.activity.vibeLabel"),
          hint: t("forms.activity.vibeHint", { max: ACTIVITY_VIBE_MAX }),
          max: ACTIVITY_VIBE_MAX,
          options: ACTIVITY_VIBES.map((v) => ({ value: v, label: has(`activityVibes.${v}`) ? t(`activityVibes.${v}`) : v, emoji: ACTIVITY_VIBE_EMOJI[v] })),
        },
      ],
    },
    {
      title: "",
      fields: [
        {
          type: "multi",
          key: "activity_dealbreakers",
          label: t("forms.activity.dealbreakersLabel"),
          hint: t("forms.activity.dealbreakersHint"),
          options: ACTIVITY_DEALBREAKERS.map((v) => ({ value: v, label: has(`activityDealbreakers.${v}`) ? t(`activityDealbreakers.${v}`) : v })),
        },
      ],
    },
    {
      title: "",
      fields: [
        {
          type: "multi",
          key: "activity_priorities",
          label: t("forms.activity.prioritiesLabel"),
          hint: t("forms.activity.prioritiesHint", { max: ACTIVITY_PRIORITY_MAX }),
          max: ACTIVITY_PRIORITY_MAX,
          required: true,
          options: ACTIVITY_PRIORITIES.map((o) => ({ ...o, label: has(`activityPriorities.${o.value}`) ? t(`activityPriorities.${o.value}`) : o.label })),
        },
      ],
    },
  ];

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
    // These answers refine the displayed vibe; best-effort so a recompute
    // hiccup never blocks the save.
    try {
      const res = await recomputeDisplayedVibe();
      const evolved = res.changed
        ? ARCHETYPES[res.archetype as VibeDimension]
        : null;
      if (evolved) toast(t("forms.activity.evolvedToast", { name: evolved.name, emoji: evolved.emoji }), "success");
    } catch {}
    setSaving(false);
    if (onDone) onDone();
    else if (redirectAfter) router.push(redirectAfter);
    else router.refresh();
  }

  if (!initial) return null;

  return (
    <>
      <Wizard
        title={t("forms.activity.title")}
        pages={pages}
        initial={initial}
        submitting={saving}
        finishLabel={t("forms.activity.finish")}
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
