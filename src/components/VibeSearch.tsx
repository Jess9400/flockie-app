"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";

// Single search bar for the Vibes browse page: one field that matches vibe
// titles, categories, and cities. Filter controls are passed in as `children`
// and rendered inside the same bar, so the whole surface reads as one control.
export default function VibeSearch({
  q,
  children,
}: {
  q: string;
  children?: React.ReactNode;
}) {
  const t = useTranslations("components");
  const router = useRouter();
  const [query, setQuery] = useState(q);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (query.trim()) p.set("q", query.trim());
    router.push(`/vibes${p.toString() ? `?${p.toString()}` : ""}`);
  }

  function clear() {
    setQuery("");
    router.push("/vibes");
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 flex items-center gap-2 rounded-full border border-ink/15 bg-white py-1.5 pl-4 pr-1.5 shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
    >
      <Search size={18} className="shrink-0 text-muted" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("vibeSearch.placeholderCombined")}
        className="min-w-0 flex-1 bg-transparent py-1 font-medium text-ink outline-none placeholder:text-muted"
      />
      {query && (
        <button
          type="button"
          onClick={clear}
          aria-label={t("vibeSearch.clearAriaLabel")}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-cream hover:text-ink"
        >
          <X size={16} />
        </button>
      )}
      {children && <div className="flex shrink-0 items-center gap-1.5">{children}</div>}
    </form>
  );
}
