"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";

// Always-reachable Create action. Expands to vibe / activity choices.
export default function CreateFab() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2.5">
      <div
        className={`flex flex-col items-end gap-2 transition-all duration-200 ${
          open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <Link
          href="/vibes/new"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 rounded-full border-[3px] border-ink bg-flockie-coral px-4 py-2.5 text-sm font-extrabold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)]"
        >
          🎟️ Create a vibe
        </Link>
        <Link
          href="/match/trip?kind=activity"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 rounded-full border-[3px] border-ink bg-flockie-blue px-4 py-2.5 text-sm font-extrabold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)]"
        >
          🧭 Create an activity
        </Link>
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close create menu" : "Create"}
        className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-ink bg-flockie-coral text-white shadow-[0_5px_0_0_rgba(10,37,69,1)] transition-all active:translate-y-[3px] active:shadow-[0_2px_0_0_rgba(10,37,69,1)]"
      >
        <span className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}>
          {open ? <X size={26} /> : <Plus size={28} />}
        </span>
      </button>
    </div>
  );
}
