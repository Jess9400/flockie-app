"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

type PlaceHit = { name: string; address: string | null; url: string };

// Text field with live venue suggestions (via /api/places → Google Places when
// keyed, else free OpenStreetMap). Typing keeps a free-text plan; tapping a
// suggestion fills the name and a real maps URL. A "browse on Maps" link stays
// as an escape hatch.
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
  const [openList, setOpenList] = useState(false);
  const justPicked = useRef(false);

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

  return (
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
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(h)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-cream"
              >
                <MapPin size={14} className="mt-0.5 shrink-0 text-flockie-blue" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-ink">{h.name}</span>
                  {h.address && <span className="block truncate text-xs text-muted">{h.address}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <a
        href={browseHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-flockie-blue"
      >
        <MapPin size={13} /> {browseLabel}
      </a>
    </div>
  );
}
