"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  isVibeGoal,
  isVibeGroupSize,
  matchingCategoriesFor,
  matchingTagsFor,
  normalizeVibeTraits,
  personaFromVibeTraits,
  socialPreferenceFor,
  type VibeGroupSize,
  type VibeTraits,
  VIBE_ONBOARDING_INTERESTS,
  VIBE_ONBOARDING_STYLES,
} from "./vibe-onboarding";

export type SaveVibeOnboardingInput = {
  interests: string[];
  styles: string[];
  groupSize: string;
  goal: string;
  traits: VibeTraits;
};

const interestIds = new Set(VIBE_ONBOARDING_INTERESTS.map((interest) => interest.id));
const styleIds = new Set(VIBE_ONBOARDING_STYLES.map((style) => style.id));

function validUniqueIds(values: string[], allowed: Set<string>, minimum: number, maximum: number) {
  return (
    values.length >= minimum &&
    values.length <= maximum &&
    new Set(values).size === values.length &&
    values.every((value) => allowed.has(value))
  );
}

function validateInput(input: SaveVibeOnboardingInput): VibeGroupSize {
  if (!validUniqueIds(input.interests, interestIds, 3, 5)) {
    throw new Error("Choose between 3 and 5 interests");
  }
  if (!validUniqueIds(input.styles, styleIds, 1, 3)) {
    throw new Error("Choose between 1 and 3 vibe styles");
  }
  if (!isVibeGroupSize(input.groupSize)) throw new Error("Choose a group size");
  if (!isVibeGoal(input.goal)) throw new Error("Choose what you are hoping to find");
  if (
    !Number.isFinite(input.traits.spontaneity) ||
    !Number.isFinite(input.traits.social) ||
    !Number.isFinite(input.traits.energy)
  ) {
    throw new Error("Choose valid vibe traits");
  }
  return input.groupSize;
}

export async function saveVibeOnboarding(input: SaveVibeOnboardingInput) {
  const groupSize = validateInput(input);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const traits = normalizeVibeTraits(input.traits);
  const persona = personaFromVibeTraits(traits);
  const { error } = await supabase
    .from("profiles")
    .update({
      vibe_interests: input.interests,
      activity_vibe: matchingTagsFor(input.styles),
      activities: matchingCategoriesFor(input.interests),
      activity_social: socialPreferenceFor(groupSize),
      vibe_goal: input.goal,
      vibe_traits: traits,
      vibe_persona: persona,
      vibe_completed_at: new Date().toISOString(),
      activity_prefs_complete: true,
    })
    .eq("id", user.id);

  if (error) throw error;
  return { persona, traits };
}

export async function updateVibeTraits(traitsInput: VibeTraits) {
  if (
    !Number.isFinite(traitsInput.spontaneity) ||
    !Number.isFinite(traitsInput.social) ||
    !Number.isFinite(traitsInput.energy)
  ) {
    throw new Error("Choose valid vibe traits");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const traits = normalizeVibeTraits(traitsInput);
  const persona = personaFromVibeTraits(traits);
  const { error } = await supabase
    .from("profiles")
    .update({ vibe_traits: traits, vibe_persona: persona })
    .eq("id", user.id);

  if (error) throw error;
  return { persona, traits };
}
