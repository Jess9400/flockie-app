export type VibeDimension =
  | "culture"
  | "social"
  | "food"
  | "night"
  | "adventure"
  | "wellness";

export type VibeScores = Record<VibeDimension, number>;

export type MoodAnswer = { type: "mood"; index: number };
export type SwipeAnswer = { type: "swipe"; side: "left" | "right" };
export type MultiAnswer = { type: "multi"; indices: number[] };
export type SliderAnswer = { type: "slider"; value: number };
export type TapAnswer = { type: "tap"; index: number };

export type Answer =
  | MoodAnswer
  | SwipeAnswer
  | MultiAnswer
  | SliderAnswer
  | TapAnswer;

export interface VibeResponseRow {
  question_id: string;
  answer: Answer;
}

export interface Archetype {
  key: VibeDimension;
  name: string;
  emoji: string;
  gradientFrom: string;
  gradientTo: string;
  description: string;
  insight: string;
  compatibleWith: VibeDimension[];
}
