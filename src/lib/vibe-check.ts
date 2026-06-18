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

// ─────────────────────────── Activity vibe check ───────────────────────────
// Parallel questionnaire for local activity/event matching (used later).

export const ACTIVITY_CATEGORIES: { group: string; items: string[] }[] = [
  {
    group: "Physical / Outdoor",
    items: [
      "Surf", "Yoga", "Hiking / trekking", "Rock climbing", "Running",
      "Cycling", "Skiing / snowboarding", "Diving / snorkeling",
      "Tennis / padel", "Pilates / barre", "Martial arts", "Dancing",
    ],
  },
  {
    group: "Creative / Cultural",
    items: [
      "Painting / drawing", "Photography", "Writing / journaling",
      "Music (playing)", "Film / cinema", "Theater", "Museum visits",
      "Architecture / design", "Pottery / crafts", "Cooking / food experiences",
    ],
  },
  {
    group: "Social / Lifestyle",
    items: [
      "Bar hopping / nightlife", "Live music / concerts",
      "Coffee culture / café-hopping", "Wine tasting", "Board games",
      "Reading / book clubs", "Language exchanges", "Volunteering",
      "Meditation / mindfulness",
    ],
  },
  {
    group: "Wellness / Self-improvement",
    items: [
      "Breathwork", "Sound baths", "Cold plunges / ice baths", "Saunas",
      "Sober events", "Plant medicine ceremonies", "Spa days",
    ],
  },
  {
    group: "Work / Professional",
    items: [
      "Coworking", "Networking / business events", "Conferences / meetups",
      "Skill-share workshops", "Investor / startup events",
    ],
  },
];

export const SKILL_SCALE: [string, string, string, string, string] = [
  "Curious beginner",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert / pro",
];

export const ACTIVITY_SOCIAL_SCALE: [string, string, string, string, string] = [
  "Alone, focused, in flow",
  "With 1-2 close friends",
  "Small group (3-5)",
  "Bigger group (6-10)",
  "The bigger the better",
];

export const INTENSITY_SCALE: [string, string, string, string, string] = [
  "Pure leisure, here to enjoy",
  "Casual / light effort",
  "Balanced, work and play",
  "High effort, challenge me",
  "All in, hardest version",
];

export const ACTIVITY_VIBES = [
  "Quiet, focused, no chitchat",
  "Social, lots of conversation",
  "Competitive / goal-oriented",
  "Creative / open-ended",
  "Spiritual / contemplative",
  "Party / energetic / loud",
  "Educational / structured",
] as const;
export const ACTIVITY_VIBE_MAX = 2;

export const ACTIVITY_DEALBREAKERS = [
  "Sober events only",
  "Drinking is fine",
  "Smoke-free",
  "Vegetarian / vegan",
  "Same-gender preferred",
  "Beginner-friendly required",
  "LGBTQ+ friendly required",
  "Quiet / no party energy",
  "Accessibility needs",
] as const;

export const ACTIVITY_ONE_LINER_PROMPT =
  "Finish: “At an activity, I'm the kind of person who…”";

export type ActivityAnswers = {
  activities: string[];
  activity_skills: Record<string, number>; // activity -> 1..5
  activity_social: number | null;
  activity_intensity: number | null;
  activity_vibe: string[];
  activity_dealbreakers: string[];
  activity_one_liner: string;
};

export const EMPTY_ACTIVITY: ActivityAnswers = {
  activities: [],
  activity_skills: {},
  activity_social: null,
  activity_intensity: null,
  activity_vibe: [],
  activity_dealbreakers: [],
  activity_one_liner: "",
};

export type Profile = VibeAnswers &
  ActivityAnswers & {
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
