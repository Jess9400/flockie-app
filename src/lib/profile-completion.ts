import type { Profile } from "@/lib/vibe-check";

// Single source of truth for "% profile complete", spanning the 3 gated forms:
// Profile (signup basics + personality vibe), Trip vibe, and Activity vibe.
// Trip/Activity "done" is driven by the completion flags the wizards set on
// finish — not by every optional field — so finishing a form always reads 100%.
export type CompletionInput = Partial<Profile> & {
  trip_prefs_complete?: boolean | null;
  activity_prefs_complete?: boolean | null;
  archetype?: string | null;
  vibe_completed_at?: string | null;
};

export type CompletionSegment = {
  key: "profile" | "trip" | "activity";
  label: string;
  pct: number;
  done: boolean;
};

function pct(checks: boolean[]): number {
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function profileCompletion(p: CompletionInput): {
  segments: CompletionSegment[];
  overall: number;
} {
  const basics = [
    !!p.display_name,
    p.age != null,
    !!p.home_city,
    (p.photos?.length ?? 0) > 0,
    !!p.archetype || !!p.vibe_completed_at, // personality vibe done
  ];
  const profilePct = pct(basics);

  const tripDone = !!p.trip_prefs_complete;
  const activityDone = !!p.activity_prefs_complete;

  const segments: CompletionSegment[] = [
    { key: "profile", label: "Profile", pct: profilePct, done: profilePct >= 100 },
    { key: "trip", label: "Trip vibe", pct: tripDone ? 100 : 0, done: tripDone },
    { key: "activity", label: "Activity vibe", pct: activityDone ? 100 : 0, done: activityDone },
  ];
  const overall = Math.round(segments.reduce((s, x) => s + x.pct, 0) / segments.length);
  return { segments, overall };
}
