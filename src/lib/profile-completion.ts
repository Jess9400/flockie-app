import type { Profile } from "@/lib/vibe-check";

// Single source of truth for "% profile complete", spanning the 3 gated forms:
// Profile basics (the signup/personality form), Trip vibe, and Activity vibe.
export type CompletionSegment = {
  key: "profile" | "trip" | "activity";
  label: string;
  pct: number;
};

function pct(checks: boolean[]): number {
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function profileCompletion(p: Partial<Profile>): {
  segments: CompletionSegment[];
  overall: number;
} {
  const basics = [
    !!p.display_name,
    p.age != null,
    !!p.gender,
    !!p.home_city,
    (p.photos?.length ?? 0) > 0,
  ];
  const trip = [
    p.planning != null,
    p.pace != null,
    p.social_energy != null,
    p.budget != null,
    p.nightlife != null,
    p.adventurousness != null,
    (p.trip_vibe?.length ?? 0) > 0,
    (p.travel_style?.length ?? 0) > 0,
    !!p.one_liner?.trim(),
  ];
  const activity = [
    (p.activities?.length ?? 0) > 0,
    Object.keys(p.activity_skills ?? {}).length > 0,
    p.activity_social != null,
    p.activity_intensity != null,
    (p.activity_vibe?.length ?? 0) > 0,
    !!p.activity_one_liner?.trim(),
  ];

  const segments: CompletionSegment[] = [
    { key: "profile", label: "Profile", pct: pct(basics) },
    { key: "trip", label: "Trip vibe", pct: pct(trip) },
    { key: "activity", label: "Activity vibe", pct: pct(activity) },
  ];
  const overall = Math.round(segments.reduce((s, x) => s + x.pct, 0) / segments.length);
  return { segments, overall };
}
