"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, Globe } from "lucide-react";
import { setUserLocale } from "@/app/actions/locale";

type Option = { code: string; label: string };

// Order matches the founder's target markets. Labels are shown in-language so
// each option is recognizable regardless of the current UI locale.
const OPTIONS: Option[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
];

const ONE_YEAR = 60 * 60 * 24 * 365;

// Cookie-based locale switcher (no URL routing). Writes NEXT_LOCALE and calls
// router.refresh() so server components re-render in the new locale.
export default function LanguageSwitcher() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(code: string) {
    document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;
    setOpen(false);
    // Persist to profiles.locale so localized emails follow the user's choice.
    // Fire-and-forget: the cookie already drives the UI, and setUserLocale
    // no-ops when signed out.
    void setUserLocale(code);
    // Re-render server components (layout resolves the cookie) in the new locale.
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("language")}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 bg-white"
      >
        <Globe size={18} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-44 rounded-2xl border border-ink/15 bg-white p-2 shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
        >
          {OPTIONS.map((opt) => {
            const active = opt.code === locale;
            return (
              <button
                key={opt.code}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => choose(opt.code)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-bold ${
                  active ? "bg-flockie-coral text-white" : "text-ink hover:bg-navy/5"
                }`}
              >
                {opt.label}
                {active && <Check size={16} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
