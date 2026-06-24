"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CONTINENTS, FLOCK_LANGUAGES, GROUP_GENDERS, GROUP_SIZE_BUCKETS } from "@/lib/trips";

// Find a Flock filter bar. Each select rewrites the URL (and resets to page 1)
// so the server component re-queries with the chosen filters.
export default function FlockFilters() {
  const router = useRouter();
  const sp = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page"); // any filter change goes back to page 1
    const qs = params.toString();
    router.push(qs ? `/flocks?${qs}` : "/flocks");
  }

  const sel =
    "rounded-full border-2 border-ink bg-white px-3 py-1.5 text-xs font-bold text-ink outline-none";

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <select className={sel} value={sp.get("continent") ?? ""} onChange={(e) => setParam("continent", e.target.value)}>
        <option value="">All continents</option>
        {CONTINENTS.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <select className={sel} value={sp.get("gender") ?? ""} onChange={(e) => setParam("gender", e.target.value)}>
        <option value="">Any group</option>
        {GROUP_GENDERS.map((g) => (
          <option key={g.value} value={g.value}>{g.label}</option>
        ))}
      </select>
      <select className={sel} value={sp.get("size") ?? ""} onChange={(e) => setParam("size", e.target.value)}>
        <option value="">Any size</option>
        {GROUP_SIZE_BUCKETS.map((b) => (
          <option key={b.value} value={b.value}>{b.label} people</option>
        ))}
      </select>
      <select className={sel} value={sp.get("language") ?? ""} onChange={(e) => setParam("language", e.target.value)}>
        <option value="">Any language</option>
        {FLOCK_LANGUAGES.map((l) => (
          <option key={l} value={l}>{l}</option>
        ))}
      </select>
    </div>
  );
}
