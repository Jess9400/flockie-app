"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type SocialVisibility = "members" | "connections" | "private";

const OPTION_VALUES: SocialVisibility[] = ["connections", "members", "private"];

export default function SocialVisibilityControl({
  userId,
  initial,
}: {
  userId: string;
  initial: SocialVisibility;
}) {
  const t = useTranslations("settings");
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: SocialVisibility) {
    if (busy || next === value) return;
    const previous = value;
    setValue(next);
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ social_visibility: next })
      .eq("id", userId);
    setBusy(false);
    if (updateError) {
      setValue(previous);
      setError(t("socialVisibility.saveError"));
    }
  }

  return (
    <section className="rounded-2xl border-2 border-ink bg-white p-4">
      <h2 className="font-fredoka text-lg font-semibold text-navy">
        {t("socialVisibility.title")}
      </h2>
      <p className="mt-1 text-xs font-medium leading-relaxed text-muted">
        {t("socialVisibility.subtitle")}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {OPTION_VALUES.map((optionValue) => {
          const selected = value === optionValue;
          return (
            <button
              key={optionValue}
              type="button"
              disabled={busy}
              onClick={() => change(optionValue)}
              className={`rounded-2xl border-2 p-3 text-left transition-colors disabled:opacity-60 ${
                selected
                  ? "border-ink bg-flockie-blue text-white"
                  : "border-ink/15 bg-[#FCF9F4] text-navy"
              }`}
            >
              <span className="block text-sm font-extrabold">
                {t(`socialVisibility.options.${optionValue}.label`)}
              </span>
              <span
                className={`mt-1 block text-[11px] font-medium leading-relaxed ${
                  selected ? "text-white/85" : "text-muted"
                }`}
              >
                {t(`socialVisibility.options.${optionValue}.description`)}
              </span>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs font-bold text-red-700">{error}</p>}
    </section>
  );
}
