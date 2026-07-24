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
  type Choice,
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
  const toast = useToast();
  const t = useTranslations("vibeCheck");
  const tc = useTranslations("components");
  const [initial, setInitial] = useState<WizardAnswers | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Resolve a data-driven label, falling back to the lib's raw English text so
  // any unmapped/custom value still renders.
  const has = (key: string) => t.has(key);
  const localizeChoices = (set: string, choices: Choice[]) =>
    choices.map((o) => ({ ...o, label: has(`choices.${set}.${o.value}`) ? t(`choices.${set}.${o.value}`) : o.label }));

  // Trimmed to ONE page with the 5 questions that still matter (founder call
  // 2026-07-25): pace, budget, planning, trip vibe, dealbreakers. Dealbreakers
  // stay because buddy_hard_block reads the same-gender preference; the rest is
  // trip-planning context only — Vibes-only scoring never reads it.
  const pages = [
    {
      title: "",
      fields: [
        { type: "select" as const, key: "pace", label: t("forms.trip.pace"), required: true, options: localizeChoices("pace", PACE_CHOICES) },
        { type: "select" as const, key: "budget", label: t("forms.trip.budget"), required: true, options: localizeChoices("budget", BUDGET_CHOICES) },
        { type: "select" as const, key: "planning", label: t("forms.trip.planning"), required: true, options: localizeChoices("planning", PLANNING_CHOICES) },
        {
          type: "multi" as const,
          key: "trip_vibe",
          label: t("forms.trip.tripVibeLabel"),
          hint: t("forms.trip.tripVibeHint", { max: MAX_TAGS }),
          max: MAX_TAGS,
          options: TRIP_VIBES.map((v) => ({ value: v, label: tc.has(`tripTypes.${v}`) ? tc(`tripTypes.${v}`) : v, emoji: TRIP_VIBE_EMOJI[v] })),
        },
        {
          type: "multi" as const,
          key: "dealbreakers",
          label: t("forms.trip.dealbreakersLabel"),
          hint: t("forms.trip.dealbreakersHint"),
          options: DEALBREAKERS.map((v) => ({ value: v, label: has(`dealbreakers.${v}`) ? t(`dealbreakers.${v}`) : v })),
        },
      ],
    },
  ];

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
        budget: toInt(a.budget),
        trip_vibe: a.trip_vibe ?? [],
        dealbreakers: a.dealbreakers ?? [],
      })
      .eq("id", userId);
    if (error) {
      setSaving(false);
      return setErr(error.message);
    }
    // Separate, migration-safe flag write (column may not exist yet).
    await supabase.from("profiles").update({ trip_prefs_complete: true }).eq("id", userId);
    // These answers refine the displayed vibe; best-effort so a recompute
    // hiccup never blocks the save.
    try {
      const res = await recomputeDisplayedVibe();
      const evolved = res.changed
        ? ARCHETYPES[res.archetype as VibeDimension]
        : null;
      if (evolved) toast(t("forms.trip.evolvedToast", { name: evolved.name, emoji: evolved.emoji }), "success");
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
        title={t("forms.trip.title")}
        pages={pages}
        initial={initial}
        submitting={saving}
        finishLabel={t("forms.trip.finish")}
        onComplete={complete}
        onClose={onClose}
      />
      {err && (
        <p className="fixed inset-x-0 bottom-3 z-[60] text-center font-nunito text-sm font-bold text-flockie-coral">{err}</p>
      )}
    </>
  );
}
