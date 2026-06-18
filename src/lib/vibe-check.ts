// Vibe-check field definitions. Personality-style, short. The friend version
// is optional for now. These options also map to the `profiles` table columns
// (see supabase/schema.sql) and will feed the matching algorithm later.

export const GENDERS = ["Woman", "Man", "Non-binary", "Prefer not to say"] as const;

export const RELATIONSHIP_STATUS = ["Single", "In a relationship", "It's complicated", "Prefer not to say"] as const;

export const SEASONS = ["Spring", "Summer", "Autumn", "Winter"] as const;

export const PLANNING_STYLE = ["Go with the flow", "A loose plan", "Plan everything"] as const;

export const MBTI_TYPES = [
  "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP",
] as const;

// Free-pick chips
export const HOBBIES = [
  "Hiking", "Surfing", "Yoga", "Photography", "Cooking", "Live music",
  "Museums", "Nightlife", "Coffee", "Reading", "Gaming", "Running",
  "Climbing", "Diving", "Cycling", "Foodie", "Wellness", "Festivals",
] as const;

export const ACTIVITIES = [
  "Beach days", "City breaks", "Backpacking", "Road trips", "Camping",
  "Wellness retreats", "Food tours", "Adventure sports", "Cultural trips",
  "Nightlife", "Coworking", "Volunteering",
] as const;

// Toggle-style booleans surfaced as friendly questions
export const TOGGLES = [
  { key: "outdoor_person", label: "Are you an outdoor person?" },
  { key: "night_owl", label: "Night owl?" },
] as const;

export type VibeCheck = {
  display_name: string;
  age: number | null;
  gender: string | null;
  relationship_status: string | null;
  bio: string;
  video_url: string | null;
  photos: string[];
  hobbies: string[];
  favorite_activities: string[];
  places_visited: string[];
  outdoor_person: boolean | null;
  night_owl: boolean | null;
  planning_style: string | null;
  preferred_season: string | null;
  mbti: string | null;
  home_city: string | null;
  onboarding_complete: boolean;
};
