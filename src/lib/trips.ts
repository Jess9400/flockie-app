// Shared labels for trip budget/pace (1-5 scales).
export const BUDGET_LABELS = ["Backpacker", "Budget", "Mid-range", "Comfort", "Luxury"] as const;
export const PACE_LABELS = ["Very slow", "Relaxed", "Balanced", "Active", "Non-stop"] as const;

export function tripDays(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  return Math.max(1, Math.round((+new Date(end) - +new Date(start)) / 86400000) + 1);
}

// ── Flock filter vocabularies (also written by the Flock creation form) ──────
export const CONTINENTS = [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Oceania",
  "Antarctica",
] as const;

export const FLOCK_LANGUAGES = [
  "English",
  "Spanish",
  "Portuguese",
  "French",
  "German",
  "Italian",
  "Arabic",
  "Mandarin",
  "Hindi",
  "Japanese",
  "Russian",
  "Other",
] as const;

export const GROUP_GENDERS = [
  { value: "any", label: "Everyone" },
  { value: "women", label: "Women only" },
  { value: "men", label: "Men only" },
] as const;

// Group-size buckets for the Find a Flock filter.
export const GROUP_SIZE_BUCKETS = [
  { value: "3-5", label: "3–5", min: 3, max: 5 },
  { value: "6-8", label: "6–8", min: 6, max: 8 },
  { value: "9", label: "9+", min: 9, max: 999 },
] as const;
