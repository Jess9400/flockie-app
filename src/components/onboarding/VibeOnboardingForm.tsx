"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { withReturnTo } from "@/lib/redirects";
import { saveVibeOnboarding } from "@/lib/onboarding/vibe-onboarding-actions";
import {
  type VibeGroupSize,
  VIBE_GOALS,
  VIBE_GROUP_SIZES,
  VIBE_ONBOARDING_INTERESTS,
  VIBE_ONBOARDING_STYLES,
} from "@/lib/onboarding/vibe-onboarding";

const GROUP_SIZE_COPY: Record<VibeGroupSize, { emoji: string; title: string; body: string }> = {
  small: { emoji: "🍷", title: "Just a few of us", body: "3 or 4, cosy" },
  medium: { emoji: "🎉", title: "A good group", body: "Around a big table, plenty going on" },
  big: { emoji: "🌆", title: "The more the merrier", body: "Big and open, meet loads of people" },
};

const GOAL_COPY: Record<(typeof VIBE_GOALS)[number], { emoji: string; title: string }> = {
  crew: { emoji: "🔁", title: "A regular crew - people I’d see again" },
  friends: { emoji: "🎯", title: "One or two friends I really click with" },
  doers: { emoji: "🚀", title: "People who’ll do the stuff I love" },
  out: { emoji: "🌱", title: "A reason to get out more often" },
};

function toggle(values: string[], value: string, maximum: number) {
  if (values.includes(value)) return values.filter((item) => item !== value);
  return values.length < maximum ? [...values, value] : values;
}

export function VibeOnboardingForm({ returnTo }: { returnTo?: string | null }) {
  const router = useRouter();
  const [interests, setInterests] = useState<string[]>([]);
  const [styles, setStyles] = useState<string[]>([]);
  const [groupSize, setGroupSize] = useState<VibeGroupSize | null>(null);
  const [goal, setGoal] = useState<(typeof VIBE_GOALS)[number] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completedSteps = [interests.length >= 3, styles.length > 0, !!groupSize, !!goal].filter(Boolean).length;
  const canSubmit = completedSteps === 4;
  const hint =
    interests.length < 3
      ? `Pick ${3 - interests.length} more interest${3 - interests.length === 1 ? "" : "s"} to start`
      : styles.length === 0
        ? "Now pick a vibe or two"
        : !groupSize
          ? "And your ideal group size"
          : !goal
            ? "Last one - what are you hoping to find?"
            : "You’re all set";

  async function submit() {
    if (!canSubmit || !groupSize || !goal || saving) return;
    setSaving(true);
    setError(null);

    const social = groupSize === "big" ? 26 : groupSize === "small" ? 72 : 48;
    const traits = {
      spontaneity: styles.includes("spontaneous") ? 24 : 62,
      social: Math.max(10, Math.min(90, social + (styles.includes("deep_conversations") ? 10 : 0) - (styles.includes("social") ? 14 : 0))),
      energy: styles.includes("energetic") ? 22 : styles.includes("chill") ? 80 : 50,
    };

    try {
      await saveVibeOnboarding({ interests, styles, groupSize, goal, traits });
      router.push(withReturnTo("/onboarding/vibe-check/reveal", returnTo));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn’t save your Vibe. Try again.");
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-cream font-nunito">
      <div className="border-b border-ink/10 bg-white px-5 pb-3 pt-5">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-flockie-coral">Your Vibe check · under a minute</p>
        <h1 className="mt-1 text-[26px] font-black leading-tight text-navy">Let’s find <span className="text-flockie-coral">your Vibes.</span></h1>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/10">
          <div className="h-full rounded-full bg-flockie-coral transition-all" style={{ width: `${completedSteps * 25}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-5">
        <Question number="1" title="What are you always down for?" hint="Pick 3 to 5 - this is what fills your feed.">
          <div className="grid grid-cols-2 gap-2">
            {VIBE_ONBOARDING_INTERESTS.map((interest) => {
              const selected = interests.includes(interest.id);
              const locked = interests.length >= 5 && !selected;
              return (
                <button
                  key={interest.id}
                  type="button"
                  onClick={() => setInterests((current) => toggle(current, interest.id, 5))}
                  disabled={locked}
                  className={`relative flex min-h-[54px] items-center gap-2 rounded-2xl border-2 px-3 py-2 text-left text-[13px] font-extrabold transition disabled:opacity-45 ${selected ? "border-flockie-coral bg-flockie-coral/10 text-navy" : "border-ink/15 bg-white text-navy"}`}
                >
                  <span className="text-[19px]">{interest.id === "good_food" ? "🍜" : interest.id === "live_music" ? "🎶" : interest.id === "getting_active" ? "🏃" : interest.id === "art_culture" ? "🎨" : interest.id === "nightlife" ? "🍸" : interest.id === "board_games" ? "🎲" : interest.id === "outdoors" ? "🌿" : interest.id === "just_chilling" ? "☕" : interest.id === "creative_stuff" ? "📸" : interest.id === "adventure" ? "🧗" : interest.id === "films_shows" ? "🎬" : "🗣️"}</span>
                  <span>{interest.label}</span>
                  {selected && <span className="absolute right-2 top-1.5 text-[12px] text-flockie-coral">✓</span>}
                </button>
              );
            })}
          </div>
        </Question>

        <Question number="2" title="What kind of vibe feels best?" hint="Pick up to 3.">
          <div className="grid grid-cols-2 gap-2">
            {VIBE_ONBOARDING_STYLES.map((style) => {
              const selected = styles.includes(style.id);
              const locked = styles.length >= 3 && !selected;
              return (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setStyles((current) => toggle(current, style.id, 3))}
                  disabled={locked}
                  className={`relative flex min-h-[54px] items-center gap-2 rounded-2xl border-2 px-3 py-2 text-left text-[13px] font-extrabold transition disabled:opacity-45 ${selected ? "border-flockie-coral bg-flockie-coral/10 text-navy" : "border-ink/15 bg-white text-navy"}`}
                >
                  <span className="text-[19px]">{style.id === "chill" ? "😌" : style.id === "social" ? "🥂" : style.id === "energetic" ? "⚡" : style.id === "deep_conversations" ? "💬" : style.id === "creative" ? "🎨" : "✨"}</span>
                  <span>{style.label}</span>
                  {selected && <span className="absolute right-2 top-1.5 text-[12px] text-flockie-coral">✓</span>}
                </button>
              );
            })}
          </div>
        </Question>

        <Question number="3" title="Ideal group size?">
          <div className="space-y-2">
            {VIBE_GROUP_SIZES.map((size) => {
              const copy = GROUP_SIZE_COPY[size];
              const selected = groupSize === size;
              return (
                <button key={size} type="button" onClick={() => setGroupSize(size)} className={`flex w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left transition ${selected ? "border-flockie-coral bg-flockie-coral/10" : "border-ink/15 bg-white"}`}>
                  <span className="text-[25px]">{copy.emoji}</span>
                  <span><span className="block text-[14px] font-extrabold text-navy">{copy.title}</span><span className="block text-[12px] font-semibold text-muted">{copy.body}</span></span>
                  {selected && <span className="ml-auto text-flockie-coral">✓</span>}
                </button>
              );
            })}
          </div>
        </Question>

        <Question number="4" title="What are you hoping to find here?">
          <div className="space-y-2">
            {VIBE_GOALS.map((goalOption) => {
              const copy = GOAL_COPY[goalOption];
              const selected = goal === goalOption;
              return (
                <button key={goalOption} type="button" onClick={() => setGoal(goalOption)} className={`flex w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left transition ${selected ? "border-flockie-coral bg-flockie-coral/10" : "border-ink/15 bg-white"}`}>
                  <span className="text-[23px]">{copy.emoji}</span>
                  <span className="text-[13.5px] font-extrabold text-navy">{copy.title}</span>
                  {selected && <span className="ml-auto text-flockie-coral">✓</span>}
                </button>
              );
            })}
          </div>
        </Question>
      </div>

      <div className="border-t border-ink/10 bg-white px-5 py-4">
        {error && <p className="mb-2 text-center text-xs font-bold text-red-700">{error}</p>}
        <button type="button" onClick={submit} disabled={!canSubmit || saving} className="w-full rounded-2xl border border-ink/15 border-b-[5px] bg-flockie-coral py-3.5 text-[15px] font-extrabold text-white disabled:opacity-40">
          {saving ? "Saving your Vibe…" : "See my Vibes"}
        </button>
        <p className="mt-2 text-center text-[11.5px] font-semibold text-muted">{hint}</p>
      </div>
    </div>
  );
}

function Question({ number, title, hint, children }: { number: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="text-[18px] font-black text-navy"><span className="mr-2 text-[12px] uppercase tracking-wide text-flockie-coral">{number}</span>{title}</h2>
      {hint && <p className="mb-3 mt-1 text-[12px] font-semibold text-muted">{hint}</p>}
      {children}
    </section>
  );
}
