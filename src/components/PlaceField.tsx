"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

type PlaceHit = { name: string; address: string | null; url: string };

// A bare-category seed so we can fetch "top X in this city" for the quick-pick
// chips before the user types anything.
const SEED: Record<string, string> = {
  coffee: "coffee",
  restaurant: "restaurant",
  bar: "bar",
  park: "park",
  activity: "things to do",
};

const CAT_EMOJI: Record<string, string> = {
  coffee: "☕",
  restaurant: "🍽️",
  bar: "🍸",
  park: "🌳",
  activity: "🎾",
};

// Text field with (1) 2-3 quick-pick venue chips for the chosen category and
// (2) live suggestions as you type - both via /api/places (Google Places when
// keyed, else free OpenStreetMap). Tapping either fills the name + a real maps
// URL; free-text still works, and a "browse on Maps" link is the escape hatch.
export default function PlaceField({
  category,
  city,
  value,
  onChange,
  browseHref,
  browseLabel,
  placeholder,
}: {
  category: string;
  city: string | null;
  value: string;
  onChange: (v: { name: string; url: string | null }) => void;
  browseHref: string;
  browseLabel: string;
  placeholder: string;
}) {
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [recs, setRecs] = useState<PlaceHit[]>([]);
  const [openList, setOpenList] = useState(false);
  const justPicked = useRef(false);

  // Quick-pick recommendations for the category (fetched once per category/city).
  useEffect(() => {
    let alive = true;
    const seed = SEED[category] ?? category;
    fetch(
      `/api/places?q=${encodeURIComponent(seed)}&category=${encodeURIComponent(
        category
      )}&city=${encodeURIComponent(city ?? "")}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (alive) setRecs((d.results ?? []).slice(0, 3));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [category, city]);

  // Live suggestions as the user types.
  useEffect(() => {
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    let alive = true;
    const id = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/places?q=${encodeURIComponent(q)}&category=${encodeURIComponent(
            category
          )}&city=${encodeURIComponent(city ?? "")}`
        );
        const data = await res.json();
        if (alive) {
          setHits(data.results ?? []);
          setOpenList(true);
        }
      } catch {
        if (alive) setHits([]);
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [value, category, city]);

  function pick(h: PlaceHit) {
    justPicked.current = true;
    onChange({ name: h.name, url: h.url });
    setOpenList(false);
    setHits([]);
  }

  const showRecs = value.trim() === "" && recs.length > 0;

  return (
    <div className="space-y-2">
      {showRecs && (
        <div className="flex flex-wrap gap-1.5">
          {recs.map((r, i) => (
            <button
              key={`${r.name}-${i}`}
              type="button"
              onClick={() => pick(r)}
              className="flex max-w-full items-center gap-1 rounded-full border border-flockie-blue/30 bg-flockie-blue/5 px-2.5 py-1 text-xs font-bold text-ink hover:border-flockie-blue"
            >
              <span>{CAT_EMOJI[category] ?? "📍"}</span>
              <span className="truncate">{r.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange({ name: e.target.value, url: null })}
          onFocus={() => hits.length > 0 && setOpenList(true)}
          onBlur={() => setTimeout(() => setOpenList(false), 150)}
          placeholder={placeholder}
          maxLength={80}
          className="h-11 w-full rounded-xl border border-ink/25 px-4 text-sm font-medium outline-none focus:border-flockie-blue"
        />
        {openList && hits.length > 0 && (
          <ul className="absolute left-0 right-0 top-12 z-10 max-h-52 overflow-y-auto rounded-xl border border-ink/15 bg-white py-1 shadow-[0_8px_24px_rgba(10,37,69,0.14)]">
            {hits.map((h, i) => (
              <li key={`${h.name}-${i}`}>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    pick(h);
                  }}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-cream"
                >
                  <MapPin size={14} className="mt-0.5 shrink-0 text-flockie-blue" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-ink">{h.name}</span>
                    {h.address && (
                      <span className="block truncate text-xs text-muted">{h.address}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <a
        href={browseHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-bold text-flockie-blue"
      >
        <MapPin size={13} /> {browseLabel}
      </a>
    </div>
  );
}
