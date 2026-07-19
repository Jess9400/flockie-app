export const VIBE_PERSONAS = [
  "connector",
  "easygoer",
  "live_wire",
  "deep_diver",
] as const;

export type VibePersona = (typeof VIBE_PERSONAS)[number];

export const VIBE_GOALS = ["crew", "friends", "doers", "out"] as const;
export type VibeGoal = (typeof VIBE_GOALS)[number];

export type VibeTraits = {
  spontaneity: number;
  social: number;
  energy: number;
};

export type VibeOnboardingInterest = {
  id: string;
  label: string;
  matchingCategories: string[];
};

export const VIBE_ONBOARDING_INTERESTS: VibeOnboardingInterest[] = [
  { id: "good_food", label: "Good food", matchingCategories: ["coffee", "dinner", "cooking"] },
  { id: "live_music", label: "Live music", matchingCategories: ["music"] },
  { id: "getting_active", label: "Getting active", matchingCategories: ["running", "cycling", "surf", "yoga", "dance"] },
  { id: "art_culture", label: "Art & culture", matchingCategories: ["painting", "photography"] },
  { id: "nightlife", label: "Nightlife", matchingCategories: ["nightlife"] },
  { id: "board_games", label: "Board games", matchingCategories: [] },
  { id: "outdoors", label: "Outdoors", matchingCategories: ["hiking", "surf", "cycling"] },
  { id: "just_chilling", label: "Just chilling", matchingCategories: ["coffee", "wellness"] },
  { id: "creative_stuff", label: "Creative stuff", matchingCategories: ["painting", "photography", "music"] },
  { id: "adventure", label: "Adventure", matchingCategories: ["hiking", "climbing", "surf"] },
  { id: "films_shows", label: "Films & shows", matchingCategories: [] },
  { id: "deep_talks", label: "Deep talks", matchingCategories: [] },
];

export const VIBE_ONBOARDING_STYLES = [
  { id: "chill", label: "Chill", matchingTags: ["chill", "quiet"] },
  { id: "social", label: "Social", matchingTags: ["social"] },
  { id: "energetic", label: "Energetic", matchingTags: ["energetic", "party"] },
  { id: "deep_conversations", label: "Deep conversations", matchingTags: ["social", "quiet"] },
  { id: "creative", label: "Creative", matchingTags: ["creative"] },
  { id: "spontaneous", label: "Spontaneous", matchingTags: [] },
] as const;

export const VIBE_GROUP_SIZES = ["small", "medium", "big"] as const;
export type VibeGroupSize = (typeof VIBE_GROUP_SIZES)[number];

export function isVibePersona(value: unknown): value is VibePersona {
  return typeof value === "string" && VIBE_PERSONAS.includes(value as VibePersona);
}

export function isVibeGoal(value: unknown): value is VibeGoal {
  return typeof value === "string" && VIBE_GOALS.includes(value as VibeGoal);
}

export function isVibeGroupSize(value: unknown): value is VibeGroupSize {
  return typeof value === "string" && VIBE_GROUP_SIZES.includes(value as VibeGroupSize);
}

export function normalizeVibeTraits(value: VibeTraits): VibeTraits {
  const clamp = (score: number) => Math.max(0, Math.min(100, Math.round(score)));
  return {
    spontaneity: clamp(value.spontaneity),
    social: clamp(value.social),
    energy: clamp(value.energy),
  };
}

export function personaFromVibeTraits(traits: VibeTraits): VibePersona {
  const solo = traits.social > 50;
  const calm = traits.energy > 50;
  if (!solo && !calm) return "connector";
  if (!solo && calm) return "easygoer";
  if (solo && !calm) return "live_wire";
  return "deep_diver";
}

export function matchingCategoriesFor(interests: string[]) {
  return Array.from(
    new Set(
      interests.flatMap(
        (id) => VIBE_ONBOARDING_INTERESTS.find((interest) => interest.id === id)?.matchingCategories ?? []
      )
    )
  );
}

export function matchingTagsFor(styles: string[]) {
  return Array.from(
    new Set(
      styles.flatMap(
        (id) => VIBE_ONBOARDING_STYLES.find((style) => style.id === id)?.matchingTags ?? []
      )
    )
  );
}

export function socialPreferenceFor(size: VibeGroupSize) {
  return size === "small" ? 3 : size === "medium" ? 4 : 5;
}
