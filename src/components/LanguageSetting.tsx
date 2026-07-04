"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { setUserLocale } from "@/app/actions/locale";

type Option = { code: string; label: string };

// Labels shown in-language so each option is recognizable regardless of the
// current UI locale (matches the globe LanguageSwitcher).
const OPTIONS: Option[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
];

const ONE_YEAR = 60 * 60 * 24 * 365;

// Settings-page language control. Mirrors the globe switcher: writes the
// NEXT_LOCALE cookie (drives the UI), persists to profiles.locale (drives
// localized emails), then refreshes server components.
export default function LanguageSetting() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("settings");
  const [value, setValue] = useState(locale);
  const [busy, setBusy] = useState(false);

  async function change(code: string) {
    if (busy || code === value) return;
    setValue(code);
    setBusy(true);
    document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;
    await setUserLocale(code);
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border-2 border-ink bg-white p-4">
      <h2 className="font-fredoka text-lg font-semibold text-navy">
        {t("language.title")}
      </h2>
      <p className="mt-1 text-xs font-medium leading-relaxed text-muted">
        {t("language.subtitle")}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((opt) => {
          const selected = value === opt.code;
          return (
            <button
              key={opt.code}
              type="button"
              disabled={busy}
              onClick={() => change(opt.code)}
              aria-pressed={selected}
              className={`rounded-2xl border-2 p-3 text-center text-sm font-extrabold transition-colors disabled:opacity-60 ${
                selected
                  ? "border-ink bg-flockie-blue text-white"
                  : "border-ink/15 bg-[#FCF9F4] text-navy"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
