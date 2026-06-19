"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

export default function TripPicker({
  options,
  value,
  mode,
}: {
  options: { id: string; label: string }[];
  value: string;
  mode: string;
}) {
  const router = useRouter();
  if (options.length === 0) return null;
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
        Finding matches for
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => router.push(`/match?mode=${mode}&trip=${e.target.value}`)}
          className="w-full appearance-none rounded-2xl border-2 border-ink bg-white px-4 py-2.5 pr-10 font-bold outline-none"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink" />
      </div>
    </label>
  );
}
