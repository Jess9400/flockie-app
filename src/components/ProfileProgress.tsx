"use client";

import { Check } from "lucide-react";

export type ProgressSegment = { label: string; pct: number; anchor: string };

export default function ProfileProgress({
  segments,
  overall,
}: {
  segments: ProgressSegment[];
  overall: number;
}) {
  function jump(anchor: string) {
    document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="font-nunito">
      <div className="flex items-stretch gap-1">
        {segments.map((s) => {
          const done = s.pct >= 100;
          const started = s.pct > 0 && s.pct < 100;
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => jump(s.anchor)}
              className="flex flex-1 flex-col items-center gap-1"
            >
              <span
                className={`flex h-7 w-full items-center justify-center gap-1 overflow-hidden rounded-full border-2 px-1 text-[10px] font-bold leading-none ${
                  done
                    ? "border-navy bg-flockie-coral text-white"
                    : started
                      ? "border-navy bg-flockie-coral/15 text-navy"
                      : "border-navy bg-cream text-navy"
                }`}
              >
                {done && <Check size={11} strokeWidth={3} />}
                <span className="truncate">{s.label}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 font-nunito text-sm font-medium text-navy">
        Profile {overall}% complete — finish for better matches.
      </p>
    </div>
  );
}
