"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";

// Always-reachable Create action. Expands to vibe / activity choices.
export default function CreateFab() {
  const t = useTranslations("components");
  const [open, setOpen] = useState(false);

  // Sits above the mobile bottom tab bar; back to bottom-5 at sm+ where the bar is hidden.
  return (
    <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-5 z-40 flex flex-col items-end gap-2.5 sm:bottom-5">
      <div
        className={`flex flex-col items-end gap-2 transition-all duration-200 ${
          open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <Link
          href="/vibes/new"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 rounded-full border-2 border-ink/15 bg-flockie-coral px-4 py-2.5 text-sm font-extrabold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
        >
          {t("createFab.createVibe")}
        </Link>
        <Link
          href="/match/trip?kind=activity"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 rounded-full border-2 border-ink/15 bg-flockie-blue px-4 py-2.5 text-sm font-extrabold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
        >
          {t("createFab.createActivity")}
        </Link>
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? t("createFab.closeAriaLabel") : t("createFab.openAriaLabel")}
        className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink/15 bg-flockie-coral text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] transition-all active:translate-y-[3px] active:shadow-[0_2px_0_0_rgba(10,37,69,1)]"
      >
        <span className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}>
          {open ? <X size={26} /> : <Plus size={28} />}
        </span>
      </button>
    </div>
  );
}
