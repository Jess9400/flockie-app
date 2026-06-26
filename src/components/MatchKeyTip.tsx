"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const KEY = "flockie_match_key_dismissed";

// One-line legend explaining the % shown on people / vibes / flocks.
// Dismissible and remembered, so it only teaches once.
export default function MatchKeyTip() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) !== "1") setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
  }

  if (!show) return null;

  return (
    <div className="mx-4 mt-4 flex items-center gap-2 rounded-2xl border-2 border-ink bg-white px-3 py-2 text-left shadow-[0_3px_0_0_rgba(10,37,69,1)]">
      <span className="shrink-0 rounded-full border-2 border-ink bg-flockie-blue px-1.5 text-[10px] font-extrabold leading-tight text-white">
        72%
      </span>
      <p className="flex-1 text-xs font-bold text-ink/80">
        That <span className="text-ink">%</span> is your <span className="text-flockie-coral">vibe match</span>{" "}
        — how aligned a person or plan is with your vibe. Higher = more your kind of thing.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Got it"
        className="shrink-0 rounded-full p-1 text-muted transition-colors hover:bg-cream hover:text-ink"
      >
        <X size={16} />
      </button>
    </div>
  );
}
