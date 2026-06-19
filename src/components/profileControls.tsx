"use client";

import { Check } from "lucide-react";

// Whitespace-based section header (Fix 11): Fredoka title with a sky-blue
// underline only as wide as the title; optional subtitle. No container border.
export function SectionHeader({
  title,
  subtitle,
  id,
}: {
  title: string;
  subtitle?: string;
  id?: string;
}) {
  return (
    <div id={id} className="scroll-mt-20">
      <h2 className="inline-block border-b border-flockie-blue pb-1 font-fredoka text-[22px] font-semibold text-navy">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 font-nunito text-sm font-normal text-navy/60">{subtitle}</p>
      )}
    </div>
  );
}

// Multi-select chip (Fix 10): selected = filled coral; unselected = navy border;
// disabled (max reached) = greyed.
export function Chip({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled && !selected}
      onClick={onClick}
      className={`rounded-full px-4 py-2 font-nunito text-sm font-semibold transition-colors ${
        selected
          ? "bg-flockie-coral text-white"
          : disabled
            ? "cursor-not-allowed border-2 border-navy/20 bg-white text-navy/30"
            : "border-2 border-navy bg-white text-navy hover:bg-cream"
      }`}
    >
      {label}
    </button>
  );
}

// Full-width toggle pill row (Fix 9).
export function TogglePill({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-14 w-full items-center justify-between rounded-full border-2 border-navy px-5 font-nunito text-base font-medium transition-colors ${
        selected ? "bg-flockie-coral text-white" : "bg-white text-navy"
      }`}
    >
      <span className="text-left">{label}</span>
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
          selected ? "border-white bg-white text-flockie-coral" : "border-navy/40 bg-transparent text-transparent"
        }`}
      >
        <Check size={14} strokeWidth={3} />
      </span>
    </button>
  );
}

// Counter beside a section title: coral check when full, navy otherwise.
export function Counter({ n, max }: { n: number; max: number }) {
  const full = n >= max;
  return (
    <span className={`font-nunito text-sm font-semibold ${full ? "text-flockie-coral" : "text-navy/60"}`}>
      ({n}/{max}
      {full ? " ✓" : ""})
    </span>
  );
}
