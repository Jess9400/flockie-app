// Blended "displayed vibe": the archetype shown on profiles is the quiz
// result refined by trip-vibe and activity-vibe answers (quiz 0.6 / trip 0.2 /
// activity 0.2, renormalized over the forms that exist).
//
// Deliberately display-only: profiles.vibe_scores stays quiz-pure because the
// matching engine (buddy_pair_score) already consumes trip/activity answers as
// separate weighted components — blending them into the personality cosine too
// would double-count those signals.
import { VibeDimension, VibeScores } from "./types";
import { normalizeScores } from "./scoring";

const DIMS: VibeDimension[] = [
  "culture",
  "social",
  "food",
  "night",
  "adventure",
  "wellness",
];

const QUIZ_WEIGHT = 0.6;
const TRIP_WEIGHT = 0.2;
const ACTIVITY_WEIGHT = 0.2;

// The new top dimension must beat the current one by this relative margin
// (plus a small absolute floor) before the displayed archetype switches, so
// one nudged slider can't flip someone's identity back and forth.
const SWITCH_RATIO = 1.1;
const SWITCH_FLOOR = 0.02;

export type TripBlendInputs = {
  pace?: number | null;
  social_energy?: number | null;
  planning?: number | null;
  nightlife?: number | null;
  adventurousness?: number | null;
  trip_vibe?: string[] | null;
};

export type ActivityBlendInputs = {
  activities?: string[] | null;
  activity_vibe?: string[] | null;
  activity_social?: number | null;
  activity_intensity?: number | null;
};

const emptyScores = (): VibeScores => ({
  culture: 0,
  social: 0,
  food: 0,
  night: 0,
  adventure: 0,
  wellness: 0,
});

// 1..5 slider -> 0..1
const s01 = (v: number | null | undefined): number | null =>
  v == null ? null : Math.max(0, Math.min(1, (v - 1) / 4));

const avg = (values: (number | null)[]): number | null => {
  const present = values.filter((v): v is number => v != null);
  if (!present.length) return null;
  return present.reduce((sum, v) => sum + v, 0) / present.length;
};

const hasTag = (tags: string[], ...needles: string[]): number => {
  const lower = tags.map((t) => t.toLowerCase());
  return lower.some((t) => needles.some((n) => t.includes(n))) ? 1 : 0;
};

// Keyword -> dimension for the activities list (ACTIVITY_CATEGORIES labels).
const ACTIVITY_KEYWORDS: Record<VibeDimension, string[]> = {
  adventure: [
    "surf", "hiking", "climbing", "running", "cycling", "skiing",
    "diving", "martial", "tennis", "padel",
  ],
  culture: [
    "painting", "photography", "writing", "music (playing)", "film",
    "theater", "museum", "architecture", "pottery", "book club", "language",
  ],
  food: ["cooking", "food", "wine", "coffee"],
  night: ["bar hopping", "nightlife", "concert", "live music"],
  social: ["board games", "networking", "dancing", "volunteering", "conferences"],
  wellness: [
    "yoga", "pilates", "meditation", "mindfulness", "breathwork",
    "sound bath", "cold plunge", "sauna", "sober", "plant medicine", "spa",
  ],
};

function tripVector(trip: TripBlendInputs): VibeScores | null {
  const tags = trip.trip_vibe ?? [];
  const sliders = [
    trip.pace, trip.social_energy, trip.planning,
    trip.nightlife, trip.adventurousness,
  ];
  if (sliders.every((v) => v == null) && tags.length === 0) return null;

  const out = emptyScores();
  out.culture = avg([hasTag(tags, "cultural", "city exploration")]) ?? 0;
  out.social = avg([s01(trip.social_energy)]) ?? 0;
  out.food = avg([hasTag(tags, "foodie")]) ?? 0;
  out.night = avg([s01(trip.nightlife), hasTag(tags, "party")]) ?? 0;
  out.adventure =
    avg([
      s01(trip.adventurousness),
      trip.planning == null ? null : 1 - (s01(trip.planning) ?? 0),
      hasTag(tags, "adventure", "mountains"),
    ]) ?? 0;
  out.wellness =
    avg([
      trip.pace == null ? null : 1 - (s01(trip.pace) ?? 0),
      hasTag(tags, "chill", "spiritual", "beach"),
    ]) ?? 0;
  return out;
}

function activityVector(activity: ActivityBlendInputs): VibeScores | null {
  const acts = (activity.activities ?? []).map((a) => a.toLowerCase());
  const tags = activity.activity_vibe ?? [];
  if (
    acts.length === 0 &&
    tags.length === 0 &&
    activity.activity_social == null &&
    activity.activity_intensity == null
  ) {
    return null;
  }

  // Share of chosen activities that map to each dimension.
  const share = emptyScores();
  if (acts.length) {
    for (const d of DIMS) {
      const hits = acts.filter((a) =>
        ACTIVITY_KEYWORDS[d].some((k) => a.includes(k))
      ).length;
      share[d] = hits / acts.length;
    }
  }

  const out = emptyScores();
  out.culture = avg([acts.length ? share.culture : null, hasTag(tags, "creative", "educational") || null]) ?? 0;
  out.social = avg([acts.length ? share.social : null, s01(activity.activity_social), hasTag(tags, "social") || null]) ?? 0;
  out.food = avg([acts.length ? share.food : null]) ?? 0;
  out.night = avg([acts.length ? share.night : null, hasTag(tags, "party") || null]) ?? 0;
  out.adventure = avg([acts.length ? share.adventure : null, s01(activity.activity_intensity), hasTag(tags, "competitive") || null]) ?? 0;
  out.wellness = avg([acts.length ? share.wellness : null, hasTag(tags, "spiritual", "quiet") || null]) ?? 0;
  return out;
}

// Quiz is the foundation: without quiz scores there is no displayed vibe.
export function blendDisplayedScores(
  quizScores: VibeScores | null | undefined,
  trip: TripBlendInputs,
  activity: ActivityBlendInputs
): VibeScores | null {
  if (!quizScores) return null;
  const quiz = normalizeScores(quizScores);
  const tripVec = tripVector(trip);
  const actVec = activityVector(activity);

  const parts: { vec: VibeScores; w: number }[] = [{ vec: quiz, w: QUIZ_WEIGHT }];
  if (tripVec) parts.push({ vec: tripVec, w: TRIP_WEIGHT });
  if (actVec) parts.push({ vec: actVec, w: ACTIVITY_WEIGHT });

  const wsum = parts.reduce((sum, p) => sum + p.w, 0);
  const out = emptyScores();
  for (const d of DIMS) {
    out[d] = parts.reduce((sum, p) => sum + p.vec[d] * p.w, 0) / wsum;
  }
  return out;
}

// Hysteresis: keep the current archetype unless the challenger clearly wins.
// Pass current = null (e.g. right after a full quiz run) for a fresh argmax.
export function resolveArchetype(
  current: string | null | undefined,
  blended: VibeScores
): VibeDimension {
  let top: VibeDimension = DIMS[0];
  for (const d of DIMS) {
    if (blended[d] > blended[top]) top = d;
  }
  const cur = DIMS.includes(current as VibeDimension)
    ? (current as VibeDimension)
    : null;
  if (!cur || cur === top) return top;
  const clearlyBeats =
    blended[top] >= blended[cur] * SWITCH_RATIO &&
    blended[top] - blended[cur] >= SWITCH_FLOOR;
  return clearlyBeats ? top : cur;
}
