"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export default function DiscoveryToggle({
  userId,
  initial,
}: {
  userId: string;
  initial: boolean;
}) {
  const t = useTranslations("settings");
  const supabase = createClient();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next);
    setBusy(true);
    setErr(false);
    const { error } = await supabase
      .from("profiles")
      .update({ open_to_discovery: next })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      setOn(!next);
      setErr(true);
    }
  }

  return (
    <div className="rounded-2xl border border-ink/15 bg-white p-4 font-nunito">
      <div className="flex items-center justify-between">
        <div className="pr-3">
          <p className="text-sm font-extrabold text-navy">{t("discovery.title")}</p>
          <p className="text-xs font-medium text-navy/60">
            {t("discovery.description")}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={busy}
          aria-pressed={on}
          className={`relative h-7 w-12 shrink-0 rounded-full border border-ink/15 transition-colors ${
            on ? "bg-flockie-orange" : "bg-cream"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full border border-ink/15 bg-white transition-all ${
              on ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>
      {err && (
        <p className="mt-2 text-xs font-bold text-red-700">{t("saveError")}</p>
      )}
    </div>
  );
}
