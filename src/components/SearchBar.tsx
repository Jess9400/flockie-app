"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";

// Generic single search bar (same pattern as the Vibes one): one field, with
// any filter controls passed as `children` rendered inside the bar so the
// whole surface reads as one control. Preserves the page's other URL params
// (filters, view) and resets pagination on every search.
export default function SearchBar({
  basePath,
  q,
  placeholder,
  children,
}: {
  basePath: string;
  q: string;
  placeholder: string;
  children?: React.ReactNode;
}) {
  const t = useTranslations("components");
  const router = useRouter();
  const sp = useSearchParams();
  const [query, setQuery] = useState(q);

  function go(nextQ: string) {
    const p = new URLSearchParams();
    sp.forEach((v, k) => {
      if (k !== "q" && k !== "page") p.append(k, v);
    });
    if (nextQ.trim()) p.set("q", nextQ.trim());
    router.push(`${basePath}${p.toString() ? `?${p.toString()}` : ""}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go(query);
      }}
      className="flex items-center gap-2 rounded-full border border-ink/15 bg-white py-1.5 pl-4 pr-1.5 shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
    >
      <Search size={18} className="shrink-0 text-muted" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent py-1 font-medium text-ink outline-none placeholder:text-muted"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            go("");
          }}
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
