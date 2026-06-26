"use client";

import { useEffect, useState } from "react";

// Time-aware greeting with a waving accent + a live "what's happening" line.
export default function HomeHero({
  firstName,
  homeCity,
  liveCount,
}: {
  firstName: string;
  homeCity: string | null;
  liveCount: number;
}) {
  const [greeting, setGreeting] = useState("Hey");
  const [emoji, setEmoji] = useState("👋");

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) {
      setGreeting("Good morning");
      setEmoji("☀️");
    } else if (h < 18) {
      setGreeting("Good afternoon");
      setEmoji("👋");
    } else {
      setGreeting("Good evening");
      setEmoji("🌙");
    }
  }, []);

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
      <p className="mt-2 text-lg font-bold text-ink/70">What do you want to do today?</p>

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
