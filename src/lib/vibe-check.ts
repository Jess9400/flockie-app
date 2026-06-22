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

// ─────────────────── Single-tap card questions (screenshot format) ───────────
// Each is one tap-to-pick screen. `value` is the value stored on the profile —
// a numeric string for the 1..5 scale dimensions (converted to int on save),
// or a category token for the trait columns.
export type Choice = { value: string; label: string; emoji: string };

// Travel (map onto the existing pace/budget/social_energy/planning/nightlife/
// adventurousness columns the matcher already uses).
export const PACE_CHOICES: Choice[] = [
  { value: "1", label: "One place, go deep", emoji: "🐢" },
  { value: "3", label: "A bit of both", emoji: "⚖️" },
  { value: "5", label: "Many places, move fast", emoji: "🏃" },
];
export const BUDGET_CHOICES: Choice[] = [
  { value: "1", label: "Stretch every dollar", emoji: "🎒" },
  { value: "2", label: "Comfortable, not flashy", emoji: "🏨" },
  { value: "4", label: "Treat myself", emoji: "✨" },
  { value: "5", label: "Best of everything", emoji: "💎" },
];
export const SOCIAL_TRAVEL_CHOICES: Choice[] = [
  { value: "1", label: "Just one person, properly", emoji: "🧍" },
  { value: "3", label: "A small handful", emoji: "👥" },
  { value: "5", label: "The more the merrier", emoji: "🎉" },
];
export const PLANNING_CHOICES: Choice[] = [
  { value: "1", label: "Wing it", emoji: "🎲" },
  { value: "3", label: "A few anchors, rest loose", emoji: "📌" },
  { value: "5", label: "Plan it all out", emoji: "🗺️" },
];
export const NIGHTLIFE_CHOICES: Choice[] = [
  { value: "1", label: "Early nights", emoji: "🌅" },
  { value: "3", label: "Dinner and a drink", emoji: "🍷" },
  { value: "5", label: "Out till late", emoji: "🌙" },
];
export const ADVENTURE_CHOICES: Choice[] = [
  { value: "1", label: "Keep it familiar", emoji: "🧭" },
  { value: "3", label: "Adventurous within reason", emoji: "🙂" },
  { value: "5", label: "The weirder the better", emoji: "🔥" },
];

// Activity / event cards.
export const ACTIVITY_SOCIAL_CHOICES: Choice[] = [
  { value: "2", label: "An intimate few", emoji: "🧍" },
  { value: "3", label: "A handful", emoji: "👥" },
  { value: "5", label: "Big and buzzy", emoji: "🎉" },
];
export const ACTIVITY_INTENSITY_CHOICES: Choice[] = [
  { value: "1", label: "Pure leisure", emoji: "🛋️" },
  { value: "3", label: "Balanced", emoji: "⚖️" },
  { value: "5", label: "All in", emoji: "🔥" },
];
// "Walking into a room of strangers, you…" — extroversion, stored in social_style.
export const SOCIAL_STYLE_CHOICES: Choice[] = [
  { value: "5", label: "Work the room", emoji: "🗣️" },
  { value: "3", label: "Find one or two people", emoji: "🙂" },
  { value: "1", label: "Hang back, warm up slowly", emoji: "👀" },
];
// New trait columns (wired into matching):
// "What pulls you out of the house?" — activity_motivation.
export const MOTIVATION_CHOICES: Choice[] = [
  { value: "people", label: "Meeting new people", emoji: "🤝" },
  { value: "activity", label: "The actual thing we're doing", emoji: "🎯" },
  { value: "company", label: "Just not wanting to be alone", emoji: "🌙" },
];
// "Are you more the one who…" — initiator (a starter pairs best with a joiner).
export const INITIATOR_CHOICES: Choice[] = [
  { value: "starter", label: "Starts the plan", emoji: "✨" },
  { value: "joiner", label: "Happily joins the plan", emoji: "🙌" },
];

// The "weight question": which 2-3 trip dimensions matter MOST to this user.
// `value` must match the keys the matching algo weights (match-priorities.sql).
export const TRIP_PRIORITIES: { value: string; label: string; emoji: string }[] = [
  { value: "pace", label: "Same daily pace", emoji: "🕒" },
  { value: "budget", label: "Similar budget", emoji: "💸" },
  { value: "planning", label: "Plan vs. spontaneous", emoji: "🗺️" },
  { value: "social_energy", label: "Social energy", emoji: "🔋" },
  { value: "nightlife", label: "Night owl / early bird", emoji: "🌙" },
  { value: "adventurousness", label: "Adventurousness", emoji: "🧭" },
  { value: "interests", label: "Shared interests", emoji: "✨" },
];
export const PRIORITY_MAX = 3;

export const ONE_LINER_MAX = 100;

// Profile basics (separate from the vibe check questions)
// Gender is stored as a lowercase enum app-wide. "Prefer not to say" is stored
// as null and never displayed as a tag.
export const GENDER_OPTIONS = [
  { value: "woman", label: "Woman" },
  { value: "man", label: "Man" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

export function genderLabel(g: string | null | undefined): string | null {
  if (!g || g === "prefer_not_to_say") return null;
  return GENDER_OPTIONS.find((o) => o.value === g)?.label ?? null;
}
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

// Skills are rated per broad category (compact) rather than per individual
// activity. Stored in activity_skills keyed by these labels → 1..5.
export const SKILL_CATEGORIES: { value: string; label: string; emoji: string }[] = [
  { value: "Sports & outdoors", label: "Sports & outdoors", emoji: "🏃" },
  { value: "Arts & creative", label: "Arts & creative", emoji: "🎨" },
  { value: "Social & nightlife", label: "Social & nightlife", emoji: "🍸" },
  { value: "Wellness", label: "Wellness", emoji: "🧘" },
  { value: "Work", label: "Work", emoji: "💼" },
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

// The activity "weight question": which 2 dimensions matter MOST for meetups.
// `value` must match the keys weighted in match-priorities.sql.
export const ACTIVITY_PRIORITIES: { value: string; label: string; emoji: string }[] = [
  { value: "interests", label: "Shared activities", emoji: "🤝" },
  { value: "vibe", label: "Experience vibe", emoji: "🎭" },
  { value: "social", label: "Group size", emoji: "👥" },
  { value: "intensity", label: "Effort level", emoji: "🔥" },
];
export const ACTIVITY_PRIORITY_MAX = 2;

export const ACTIVITY_ONE_LINER_PROMPT =
  "Finish: “At an activity, I'm the kind of person who…”";

export type ActivityAnswers = {
  activities: string[];
  activity_skills: Record<string, number>; // category (SKILL_CATEGORIES) -> 1..5
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

// Three punchy keyword tags for the share card. Phrases are split into
// individual words ("Party / energetic / loud" -> Party, Energetic, Loud) so
// even one filled form yields 3 short, distinct tags (full travel-style
// sentences truncate to gibberish, so they're kept as a last resort).
export function topVibeTags(p: Partial<Profile>): string[] {
  const out: string[] = [];
  const push = (raw: string) => {
    const seg = raw.trim();
    if (!seg || seg.length > 16) return;
    const tag = seg.charAt(0).toUpperCase() + seg.slice(1);
    if (!out.some((o) => o.toLowerCase() === tag.toLowerCase())) out.push(tag);
  };
  const phrases = [
    ...(p.activity_vibe ?? []),
    ...(p.trip_vibe ?? []),
    ...(p.activities ?? []),
    ...(p.travel_style ?? []),
  ];
  for (const phrase of phrases) {
    for (const seg of phrase.split(/[/,]/)) {
      push(seg);
      if (out.length >= 3) return out;
    }
  }
  return out.slice(0, 3);
}

export type Profile = VibeAnswers &
  ActivityAnswers & {
    display_name: string;
    age: number | null;
    gender: string | null;
    relationship_status: string | null;
    home_city: string | null;
    bio: string | null;
    instagram: string | null;
    x_handle: string | null;
    tiktok: string | null;
    photos: string[];
    video_url: string | null;
    notifications_enabled: boolean;
    vouch_token: string | null;
    onboarding_complete: boolean;
  };
