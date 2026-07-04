"use client";

import { useEffect, useState } from "react";

// Time-aware greeting with a waving accent + a live "what's happening" line.
// The greeting variants + subline are translated on the server (getTranslations
// in home/page.tsx) and passed in, so the copy is localized while the
// time-of-day choice stays client-side (depends on the viewer's clock).
export default function HomeHero({
  firstName,
  homeCity,
  liveCount,
  greetings,
  subline,
}: {
  firstName: string;
  homeCity: string | null;
  liveCount: number;
  greetings: { morning: string; afternoon: string; evening: string };
  subline: string;
}) {
  const [greeting, setGreeting] = useState(greetings.morning);
  const [emoji, setEmoji] = useState("👋");

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) {
      setGreeting(greetings.morning);
      setEmoji("☀️");
    } else if (h < 18) {
      setGreeting(greetings.afternoon);
      setEmoji("👋");
    } else {
      setGreeting(greetings.evening);
      setEmoji("🌙");
    }
  }, [greetings]);

  return (
    <section className="relative overflow-hidden px-5 pt-12 text-center sm:pt-16">
      {/* soft animated accent */}
      <div
        aria-hidden
        className="animate-floaty pointer-events-none absolute -top-12 left-1/2 -z-10 h-44 w-80 -translate-x-1/2 rounded-full bg-flockie-coral/20 blur-3xl"
      />
      <h1 className="text-[34px] font-black leading-tight sm:text-5xl">
        {greeting}, {firstName} <span className="animate-wave">{emoji}</span>
      </h1>
      <p className="mt-2 text-lg font-bold text-ink/70">{subline}</p>

      {liveCount > 0 && (
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3 py-1 text-xs font-extrabold text-ink">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flockie-coral opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-flockie-coral" />
          </span>
          {liveCount} {liveCount === 1 ? "vibe" : "vibes"} live in {homeCity ?? "your area"} this week
        </p>
      )}
    </section>
  );
}
