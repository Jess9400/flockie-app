"use client";

import { useState } from "react";

// Find a Match — toggle between 1:1 people (Buddy) and groups/trips (Flock).
// Swipe deck wiring comes in Phase 2.
export default function MatchPage() {
  const [mode, setMode] = useState<"buddy" | "flock">("buddy");

  return (
    <main className="px-5 pt-6">
      <h1 className="text-2xl font-black">Find a match</h1>
      <p className="mt-1 text-sm font-medium text-muted">
        Swipe through vibe-matched people for your next trip (Find a Buddy), or
        browse open group trips you can join (Find a Flock). Matches are scored on
        your vibe check, never random.
      </p>

      <div className="mt-4 grid grid-cols-2 rounded-full border-2 border-ink bg-white p-1 text-sm font-bold">
        <button
          onClick={() => setMode("buddy")}
          className={`rounded-full py-2 transition-colors ${
            mode === "buddy" ? "bg-flockie-orange text-white" : "text-ink"
          }`}
        >
          Find a Buddy
        </button>
        <button
          onClick={() => setMode("flock")}
          className={`rounded-full py-2 transition-colors ${
            mode === "flock" ? "bg-flockie-blue text-white" : "text-ink"
          }`}
        >
          Find a Flock
        </button>
      </div>

      <div className="mt-6 flex h-[60vh] items-center justify-center rounded-3xl border-2 border-dashed border-ink/30 text-center text-muted">
        <p className="px-8 font-medium">
          {mode === "buddy"
            ? "Swipe deck of vibe-matched people (Phase 2)."
            : "Open Flocks & trips you can join (Phase 2)."}
        </p>
      </div>
    </main>
  );
}
