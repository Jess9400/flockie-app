"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CITIES, normalizeCity } from "@/lib/cities";

const MAX_SUGGESTIONS = 8;

type Props = {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
};

// Default input styling mirrors the app's standard field (neo-brutalist:
// 2px ink border, rounded, white bg). Forms pass their own `className` to match
// the surrounding inputs exactly.
const DEFAULT_INPUT_CLS =
  "w-full rounded-xl border-2 border-ink/15 bg-white px-3.5 py-3 text-[15px] font-bold outline-none focus:border-flockie-blue";

export default function CityAutocomplete({
  value,
  onChange,
  id,
  placeholder,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const listboxId = `${id ?? reactId}-listbox`;

  const suggestions = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return [];
    const matches = CITIES.filter((c) => c.toLowerCase().includes(query));
    // If the current value is already an exact match, don't nag with a dropdown.
    if (matches.length === 1 && matches[0].toLowerCase() === query) return [];
    return matches.slice(0, MAX_SUGGESTIONS);
  }, [value]);

  const showDropdown = open && suggestions.length > 0;

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Keep the active index in range as suggestions change.
  useEffect(() => {
    setActiveIndex((i) => (i >= suggestions.length ? -1 : i));
  }, [suggestions.length]);

  function select(city: string) {
    onChange(city);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value);
    setOpen(true);
    setActiveIndex(-1);
  }

  function handleBlur() {
    // Normalize free-text on the way out unless it's an exact list match.
    const isExact = CITIES.some((c) => c.toLowerCase() === value.trim().toLowerCase());
    if (!isExact) {
      const normalized = normalizeCity(value);
      if (normalized !== value) onChange(normalized);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      if (!showDropdown) {
        setOpen(true);
        return;
      }
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      if (!showDropdown) return;
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === "Enter") {
      if (showDropdown && activeIndex >= 0) {
        event.preventDefault();
        select(suggestions[activeIndex]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          showDropdown && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
        }
        autoComplete="off"
        className={className ?? DEFAULT_INPUT_CLS}
        value={value}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-64 overflow-y-auto rounded-2xl border-2 border-ink bg-white py-1 shadow-[3px_4px_0_0_rgba(10,37,69,1)]"
        >
          {suggestions.map((city, index) => {
            const active = index === activeIndex;
            return (
              <li
                key={city}
                id={`${listboxId}-opt-${index}`}
                role="option"
                aria-selected={active}
                // onMouseDown (not onClick) so it fires before the input's blur.
                onMouseDown={(event) => {
                  event.preventDefault();
                  select(city);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`cursor-pointer px-3.5 py-2.5 text-[15px] font-bold ${
                  active ? "bg-flockie-coral text-white" : "text-navy"
                }`}
              >
                {city}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
