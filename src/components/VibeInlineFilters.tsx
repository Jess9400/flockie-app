"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Check } from "lucide-react";

type Option = { value: string; label: string };

// Inline filter pills that live inside the Vibes search bar: a single-select
// "Any time" (time window) and a multi-select "Category". They write the same
// `when` / `category` URL params the server page reads — no popup sheet.
export default function VibeInlineFilters({
  whenOptions,
  categoryOptions,
  labels,
}: {
  whenOptions: Option[];
  categoryOptions: Option[];
  labels: { anyTime: string; category: string };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [open, setOpen] = useState<null | "when" | "category">(null);

  const when = sp.get("when") ?? "";
  const cats = sp.getAll("category");

  function build(nextWhen: string, nextCats: string[]) {
    const p = new URLSearchParams();
    const q = sp.get("q");
    if (q) p.set("q", q);
    if (nextWhen) p.set("when", nextWhen);
    nextCats.forEach((c) => p.append("category", c));
    router.push(`/vibes${p.toString() ? `?${p.toString()}` : ""}`);
  }

  const whenLabel = whenOptions.find((o) => o.value === when)?.label ?? labels.anyTime;
  const catLabel = cats.length ? `${labels.category} (${cats.length})` : labels.category;

  const pill = (active: boolean) =>
    `inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
      active ? "bg-flockie-coral text-white" : "bg-cream text-ink hover:bg-navy/5"
    }`;

  return (
    <>
      {open && <div className="fixed inset-0 z-10" onClick={() => setOpen(null)} />}

      {/* Any time */}
      <div className="relative z-20">
        <button type="button" onClick={() => setOpen(open === "when" ? null : "when")} className={pill(!!when)}>
          {whenLabel} <ChevronDown size={13} />
        </button>
        {open === "when" && (
          <div className="absolute right-0 z-30 mt-2 w-44 rounded-2xl border-2 border-ink bg-white p-1.5 shadow-[0_4px_0_rgba(10,37,69,0.15)]">
            {whenOptions.map((o) => (
              <button
                key={o.value || "any"}
                type="button"
                onClick={() => {
                  setOpen(null);
                  build(o.value, cats);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-bold ${
                  o.value === when ? "bg-cream text-ink" : "text-ink hover:bg-navy/5"
                }`}
              >
                {o.label}
                {o.value === when && <Check size={15} className="text-flockie-coral" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category (multi) */}
      <div className="relative z-20">
        <button
          type="button"
          onClick={() => setOpen(open === "category" ? null : "category")}
          className={pill(cats.length > 0)}
        >
          {catLabel} <ChevronDown size={13} />
        </button>
        {open === "category" && (
          <div className="absolute right-0 z-30 mt-2 max-h-72 w-52 overflow-y-auto rounded-2xl border-2 border-ink bg-white p-1.5 shadow-[0_4px_0_rgba(10,37,69,0.15)]">
            {categoryOptions.map((o) => {
              const on = cats.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => build(when, on ? cats.filter((c) => c !== o.value) : [...cats, o.value])}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-bold ${
                    on ? "bg-cream text-ink" : "text-ink hover:bg-navy/5"
                  }`}
                >
                  {o.label}
                  {on && <Check size={15} className="text-flockie-coral" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
