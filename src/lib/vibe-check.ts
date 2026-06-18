// Vibe check v2 — 6 sliders (compatibility math) + 2 multi-selects (filters)
// + 1 dealbreaker set (safety) + 1 one-liner. The friend-vouch form reuses the
// same questions about the user. MBTI/astrology/bio/etc. intentionally excluded.

export const MAX_TAGS = 3;

export type SliderKey =
  | "planning"
  | "pace"
  | "social_energy"
  | "budget"
  | "nightlife"
  | "adventurousness";

export const SLIDERS: {
  key: SliderKey;
  label: string;
  prompt: string;
  scale: [string, string, string, string, string];
}[] = [
  {
    key: "planning",
    label: "Planning style",
    prompt: "On a trip, do you plan every hour, or wing it?",
    scale: [
      "Detailed itinerary booked weeks ahead",
      "Plan the big things, the rest stays loose",
      "A few anchors, then go with the flow",
      "Show up and figure it out",
      "I don't know what city I'll sleep in tomorrow",
    ],
  },
  {
    key: "pace",
    label: "Daily pace",
    prompt: "What does your ideal travel day look like?",
    scale: [
      "Slow mornings, one activity, lots of rest",
      "Two things a day, leisurely",
      "Active days, evenings off",
      "Packed itinerary, sunrise to sunset",
      "I don't sleep when I travel, too much to do",
    ],
  },
  {
    key: "social_energy",
    label: "Social energy",
    prompt: "How much alone time do you need on a trip?",
    scale: [
      "4+ hours alone every day or I lose it",
      "A few hours of quiet time",
      "Flexible, depends on the day",
      "Around people most of the time",
      "Why would anyone want to be alone?",
    ],
  },
  {
    key: "budget",
    label: "Budget",
    prompt: "What's your spending style when you travel?",
    scale: [
      "Hostels, street food, every dollar counts",
      "Budget but comfortable",
      "Mid-range, occasional splurges",
      "Boutique hotels, good restaurants",
      "Luxury, I travel to relax not to save",
    ],
  },
  {
    key: "nightlife",
    label: "Nightlife",
    prompt: "What's your evening vibe?",
    scale: [
      "Asleep by 10pm, sunrise is sacred",
      "Dinner and a drink, home by midnight",
      "Late nights, but not every night",
      "Out until 2am most nights",
      "I sleep when I'm dead",
    ],
  },
  {
    key: "adventurousness",
    label: "Comfort with the unfamiliar",
    prompt: "Weird food, strange neighborhoods, getting lost on purpose…",
    scale: [
      "I want to know what I'm eating and where I'm going",
      "I'll try new things if someone vetted them",
      "Up for an adventure, within reason",
      "Getting lost is half the point",
      "If it's not uncomfortable, what's the point?",
    ],
  },
];

export const TRIP_VIBES = [
  "Chill / wellness / recharge",
  "Adventure / outdoors / active",
  "Cultural / history / museums",
  "Foodie / culinary",
  "Party / nightlife",
  "Beach / coast",
  "Mountains / nature",
  "City exploration",
  "Work-friendly / coworking",
  "Spiritual / retreat",
] as const;

export const TRAVEL_STYLES = [
  "I love photographing and documenting the trip",
  "I want to talk to locals more than tourists",
  "I'm here for the food first",
  "I want to disconnect from work",
  "I want to keep working remotely",
  "I like guided tours and structured activities",
  "I prefer wandering with no plan",
  "I'm into wellness, yoga, fitness while traveling",
  "I want to make new friends along the way",
  "I want a quiet, restorative trip",
] as const;

export const DEALBREAKERS = [
  "I smoke (or am OK with someone who does)",
  "I drink regularly when traveling",
  "I'm vegetarian / vegan / have dietary needs",
  "I prefer same-gender travel partners",
  "I need accommodation with a private bathroom",
  "I'm comfortable with last-minute plan changes",
  "I need quiet sleeping conditions",
] as const;

export const ONE_LINER_MAX = 100;

// Profile basics (separate from the vibe check questions)
export const GENDERS = ["Woman", "Man", "Non-binary", "Prefer not to say"] as const;
export const RELATIONSHIP_STATUS = [
  "Single",
  "In a relationship",
  "It's complicated",
  "Prefer not to say",
] as const;

// The 10 answers (shared shape for self + friend vouch)
export type VibeAnswers = {
  planning: number | null;
  pace: number | null;
  social_energy: number | null;
  budget: number | null;
  nightlife: number | null;
  adventurousness: number | null;
  trip_vibe: string[];
  travel_style: string[];
  dealbreakers: string[];
  one_liner: string;
};

export const EMPTY_ANSWERS: VibeAnswers = {
  planning: null,
  pace: null,
  social_energy: null,
  budget: null,
  nightlife: null,
  adventurousness: null,
  trip_vibe: [],
  travel_style: [],
  dealbreakers: [],
  one_liner: "",
};

export type Profile = VibeAnswers & {
  display_name: string;
  age: number | null;
  gender: string | null;
  relationship_status: string | null;
  home_city: string | null;
  photos: string[];
  video_url: string | null;
  vouch_token: string | null;
  onboarding_complete: boolean;
};
