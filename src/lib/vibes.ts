// Constants for the Vibe Buddy / "Create a Vibe" module.
import { format, isToday, isTomorrow } from "date-fns";
import { dfLocale, relativeWords, intlLocale } from "@/lib/date-locale";

// "Today, 3pm" / "Tomorrow, 3pm" / "Sat Jun 21, 3pm".
//
// `timeZone` (IANA, e.g. "Asia/Kolkata") renders the instant in the VIBE's own
// zone, so a Bangalore vibe reads "5pm" for everyone — server- or client-
// rendered, and regardless of the viewer's location. Without it, the time was
// rendered in the runtime zone, so a server component (UTC) and a client
// component (the viewer's browser) disagreed for the same vibe. Legacy vibes
// with no stored timezone keep the old ambient-zone behavior.
export function formatVibeWhen(iso: string, locale = "en", timeZone?: string | null): string {
  const d = new Date(iso);
  const rel = relativeWords(locale);

  if (timeZone) {
    const tag = intlLocale(locale);
    const time = new Intl.DateTimeFormat(tag, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone,
    })
      .format(d)
      .toLowerCase()
      .replace(/\s/g, "") // "5:00 pm" -> "5:00pm"
      .replace(":00", ""); // "5:00pm" -> "5pm"
    // Compute Today/Tomorrow by comparing calendar dates IN the vibe's zone.
    const dayKey = (x: Date) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(x);
    const day = dayKey(d);
    if (day === dayKey(new Date())) return `${rel.today}, ${time}`;
    if (day === dayKey(new Date(Date.now() + 86_400_000))) return `${rel.tomorrow}, ${time}`;
    const datePart = new Intl.DateTimeFormat(tag, {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(d);
    return `${datePart}, ${time}`;
  }

  // No timezone (legacy vibes): ambient-zone behavior, unchanged.
  const df = dfLocale(locale);
  const t = format(d, "h:mmaaa", { locale: df }).toLowerCase().replace(":00", "");
  if (isToday(d)) return `${rel.today}, ${t}`;
  if (isTomorrow(d)) return `${rel.tomorrow}, ${t}`;
  return `${format(d, "EEE MMM d", { locale: df })}, ${t}`;
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

// Attendee review tags for a Vibe (the event). Aggregated into weighted %.
export const VIBE_REVIEW_TAGS = [
  "Fun",
  "Good vibes",
  "Well organized",
  "Met great people",
  "Welcoming",
  "As described",
  "On time",
  "Would do again",
] as const;

export type VibeStatus =
  | "open"
  | "ranking"
  | "finalized"
  | "completed"
  | "cancelled";

export type InterestStatus =
  | "interested"
  | "requested"
  | "shortlisted"
  | "invited"
  | "confirmed"
  | "declined"
  | "standby"
  | "ghosted"
  | "removed";
