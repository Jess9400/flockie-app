"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";

export type FilterSection = {
  key: string;
  title: string;
  options: { value: string; label: string }[];
};

// A "Filters" button (sliders icon) that opens a bottom sheet of grouped chip
// options. Each section is single-select; selections map to URL params that the
// server page reads. "Show results" applies (and resets to page 1).
export default function FilterSheet({
  basePath,
  sections,
  preserveKeys = [],
}: {
  basePath: string;
  sections: FilterSection[];
  preserveKeys?: string[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Record<string, string>>({});

  const activeCount = sections.filter((s) => sp.get(s.key)).length;

  function openSheet() {
    setSel(Object.fromEntries(sections.map((s) => [s.key, sp.get(s.key) ?? ""])));
    setOpen(true);
  }
  function pick(key: string, value: string) {
    setSel((prev) => ({ ...prev, [key]: prev[key] === value ? "" : value }));
  }
  function reset() {
    setSel(Object.fromEntries(sections.map((s) => [s.key, ""])));
  }
  function apply() {
    const params = new URLSearchParams();
    preserveKeys.forEach((k) => {
      const v = sp.get(k);
      if (v) params.set(k, v);
    });
    Object.entries(sel).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-bold text-ink"
      >
        <SlidersHorizontal size={16} /> Filters
        {activeCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-flockie-coral px-1 text-[10px] font-extrabold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-t-3xl border-t-2 border-ink bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-ink/10 px-5 py-4">
              <button type="button" onClick={() => setOpen(false)} aria-label="Close">
                <X size={22} className="text-ink" />
              </button>
              <p className="font-fredoka text-lg font-bold text-ink">Filters</p>
              <span className="w-[22px]" />
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              {sections.map((s) => (
                <div key={s.key}>
                  <p className="font-fredoka text-base font-bold text-ink">{s.title}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {s.options.map((o) => {
                      const on = sel[s.key] === o.value;
                      return (
                        <button
                          key={o.value || "any"}
                          type="button"
                          onClick={() => pick(s.key, o.value)}
                          className={`rounded-full border-2 px-4 py-2 text-sm font-bold transition-colors ${
                            on
                              ? "border-ink bg-flockie-blue text-white"
                              : "border-ink/15 bg-white text-ink hover:bg-cream"
                          }`}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 border-t-2 border-ink/10 px-5 py-4">
              <button
                type="button"
                onClick={reset}
                className="font-nunito text-sm font-bold text-muted underline"
              >
                Reset all
              </button>
              <button
                type="button"
                onClick={apply}
                className="rounded-full border-2 border-ink bg-flockie-coral px-6 py-2.5 font-fredoka text-sm font-bold text-white shadow-[0_3px_0_0_#E0512C]"
              >
                Show results
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
