// Constants for the Vibe Buddy / "Create a Vibe" module.
import { format, isToday, isTomorrow } from "date-fns";

// "Today, 3pm" / "Tomorrow, 3pm" / "Sat Jun 21, 3pm"
export function formatVibeWhen(iso: string): string {
  const d = new Date(iso);
  const t = format(d, "h:mmaaa").toLowerCase().replace(":00", "");
  if (isToday(d)) return `Today, ${t}`;
  if (isTomorrow(d)) return `Tomorrow, ${t}`;
  return `${format(d, "EEE MMM d")}, ${t}`;
}


export const VIBE_CATEGORIES = [
  "surf",
  "yoga",
  "hiking",
  "running",
  "cycling",
  "climbing",
  "dance",
  "painting",
  "photography",
  "music",
  "cooking",
  "dinner",
  "coffee",
  "nightlife",
  "wellness",
  "coworking",
  "other",
] as const;

export const EVENT_VIBE_TAGS = [
  "chill",
  "social",
  "party",
  "competitive",
  "creative",
  "spiritual",
  "educational",
  "beginner-friendly",
  "quiet",
  "energetic",
] as const;
export const EVENT_VIBE_TAGS_MAX = 5;

// Toggle rules stored in vibes.dealbreaker_rules jsonb
export const DEALBREAKER_RULES: { key: string; label: string }[] = [
  { key: "sober_only", label: "Sober only" },
  { key: "vegetarian_friendly", label: "Vegetarian-friendly" },
  { key: "lgbtq_friendly", label: "LGBTQ+ friendly" },
  { key: "beginner_friendly", label: "Beginner-friendly" },
  { key: "quiet_vibe", label: "Quiet vibe" },
];

// required_skill_level: null = any
export const SKILL_REQUIREMENTS: { value: number | null; label: string }[] = [
  { value: null, label: "Any level welcome" },
  { value: 1, label: "Beginner (1-2)" },
  { value: 3, label: "Intermediate (3)" },
  { value: 4, label: "Advanced (4-5)" },
];

export type VibeStatus =
  | "open"
  | "ranking"
  | "finalized"
  | "completed"
  | "cancelled";

export type InterestStatus =
  | "interested"
  | "invited"
  | "confirmed"
  | "declined"
  | "standby"
  | "ghosted";
