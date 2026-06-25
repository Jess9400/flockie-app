"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

export default function VibeSearch({ q, city }: { q: string; city: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(q);
  const [loc, setLoc] = useState(city);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (query.trim()) p.set("q", query.trim());
    if (loc.trim()) p.set("city", loc.trim());
    router.push(`/vibes${p.toString() ? `?${p.toString()}` : ""}`);
  }

  function clear() {
    setQuery("");
    setLoc("");
    router.push("/vibes");
  }

  const active = q || city;

  return (
    <form onSubmit={submit} className="mt-7 flex flex-col gap-2 sm:flex-row">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Activity (surf, dinner, yoga…)"
        className="w-full rounded-2xl border-2 border-ink bg-white px-4 py-2.5 font-medium outline-none"
      />
      <input
        value={loc}
        onChange={(e) => setLoc(e.target.value)}
        placeholder="Location (city)"
        className="w-full rounded-2xl border-2 border-ink bg-white px-4 py-2.5 font-medium outline-none sm:max-w-[40%]"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex flex-1 items-center justify-center gap-1 rounded-2xl border-2 border-ink bg-flockie-orange px-4 py-2.5 font-bold text-white shadow-[0_3px_0_0_#E0512C] sm:flex-none"
        >
          <Search size={16} /> Search
        </button>
        {active && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear"
            className="flex items-center justify-center rounded-2xl border-2 border-ink bg-white px-3"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </form>
  );
}
