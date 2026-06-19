import { VibeDimension } from "./types";

export type ScoreWeights = Partial<Record<VibeDimension, number>>;

export interface MoodOption {
  emoji: string;
  label: string;
  gradientFrom: string;
  gradientTo: string;
  score: ScoreWeights;
}

export interface MultiOption {
  emoji: string;
  label: string;
  score: ScoreWeights;
}

export interface TapOption {
  emoji: string;
  label: string;
  score: ScoreWeights;
}

export interface MoodQuestion {
  id: "qmood";
  type: "mood";
  mechanicLabel: string;
  text: string;
  options: MoodOption[];
}

export interface SwipeQuestion {
  id: "qswipe";
  type: "swipe";
  mechanicLabel: string;
  text: string;
  left: { emoji: string; label: string; score: ScoreWeights };
  right: { emoji: string; label: string; score: ScoreWeights };
}

export interface MultiQuestion {
  id: "qgrid";
  type: "multi";
  mechanicLabel: string;
  text: string;
  options: MultiOption[];
  maxSelect: number;
}

export interface SliderQuestion {
  id: "qslider";
  type: "slider";
  mechanicLabel: string;
  text: string;
  leftLabel: string;
  rightLabel: string;
}

export interface TapQuestion {
  id: "qtap";
  type: "tap";
  mechanicLabel: string;
  text: string;
  options: TapOption[];
}

export type VibeQuestion =
  | MoodQuestion
  | SwipeQuestion
  | MultiQuestion
  | SliderQuestion
  | TapQuestion;

export const VIBE_QUESTIONS: VibeQuestion[] = [
  {
    id: "qmood",
    type: "mood",
    mechanicLabel: "Tap one",
    text: "No overthinking — which pulls you in?",
    options: [
      {
        emoji: "🕯️",
        label: "Small group, good conversation",
        gradientFrom: "#B5621E",
        gradientTo: "#D98C5F",
        score: { social: 1, culture: 1 },
      },
      {
        emoji: "🎉",
        label: "Loud, energetic, up till late",
        gradientFrom: "#0A2545",
        gradientTo: "#1A6899",
        score: { night: 2, social: 1 },
      },
      {
        emoji: "📖",
        label: "Quiet corner, just me",
        gradientFrom: "#3D6E55",
        gradientTo: "#5A9E78",
        score: { wellness: 2 },
      },
    ],
  },
  {
    id: "qswipe",
    type: "swipe",
    mechanicLabel: "Swipe or tap a side",
    text: "A plan falls through last minute. Be honest:",
    left: {
      emoji: "😤",
      label: "Ugh, was looking forward to it",
      score: { culture: 2 },
    },
    right: {
      emoji: "🎉",
      label: "Secretly relieved, more time for me",
      score: { wellness: 1, adventure: 1 },
    },
  },
  {
    id: "qgrid",
    type: "multi",
    mechanicLabel: "Tap up to 3",
    text: "Pick what pulls you in:",
    maxSelect: 3,
    options: [
      { emoji: "🏛️", label: "Museums & culture", score: { culture: 2 } },
      { emoji: "🍜", label: "Food & local spots", score: { food: 2 } },
      { emoji: "🌿", label: "Nature & outdoors", score: { adventure: 2 } },
      { emoji: "🎭", label: "Live events & shows", score: { social: 1, culture: 1 } },
      { emoji: "⚽", label: "Sports & games", score: { adventure: 1 } },
      { emoji: "🧘", label: "Wellness & calm", score: { wellness: 2 } },
      { emoji: "🌙", label: "Nightlife & bars", score: { night: 2, social: 1 } },
      { emoji: "📚", label: "Books & quiet time", score: { wellness: 1, culture: 1 } },
    ],
  },
  {
    id: "qslider",
    type: "slider",
    mechanicLabel: "Drag the slider",
    text: "How spontaneous are you, really?",
    leftLabel: "Need the plan",
    rightLabel: "Make it up as I go",
  },
  {
    id: "qtap",
    type: "tap",
    mechanicLabel: "Tap one",
    text: "Walking into a room where you don't know anyone. What instantly makes you feel less out of place?",
    options: [
      { emoji: "🗣️", label: "Someone says hi first", score: { social: 2 } },
      { emoji: "🥂", label: "Finding a drink, giving myself something to do", score: { food: 2 } },
      { emoji: "👀", label: "Scoping the room before committing to anyone", score: { culture: 1, wellness: 1 } },
      { emoji: "🎧", label: "Hanging back at the edges till I find my person", score: { wellness: 2, adventure: 1 } },
    ],
  },
];

export const TOTAL_QUESTIONS = VIBE_QUESTIONS.length;
