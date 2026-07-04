"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

const KEY = "flockie_match_key_dismissed";

// One-line legend explaining the % shown on people / vibes / flocks.
// Dismissible and remembered, so it only teaches once.
export default function MatchKeyTip() {
  const t = useTranslations("components");
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) !== "1") setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
  }

  if (!show) return null;

  return (
    <div className="mx-4 mt-4 flex items-center gap-2 rounded-2xl border-2 border-ink bg-white px-3 py-2 text-left shadow-[0_3px_0_0_rgba(10,37,69,1)]">
      <span className="shrink-0 rounded-full border-2 border-ink bg-flockie-coral px-1.5 text-[10px] font-extrabold leading-tight text-white">
        72%
      </span>
      <p className="flex-1 text-xs font-bold text-ink/80">
        {t("matchKeyTip.that")} <span className="text-ink">%</span> {t("matchKeyTip.isYour")} <span className="text-flockie-coral">{t("matchKeyTip.vibeMatch")}</span>{" "}
        {t("matchKeyTip.explanation")}
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("matchKeyTip.gotIt")}
        className="shrink-0 rounded-full p-2 text-muted transition-colors hover:bg-cream hover:text-ink"
      >
        <X size={16} />
      </button>
    </div>
  );
}
