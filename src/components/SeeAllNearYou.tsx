"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEsc } from "@/lib/use-esc";

// "See all" for the mixed near-you rail (Vibes + 1:1 activities): a small
// chooser in the same two-box language as the Buddy/Trips hubs, since the two
// destinations are genuinely different surfaces.
export default function SeeAllNearYou() {
  const t = useTranslations("home.seeAllNearYou");
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => setMounted(true), []);
  useEsc(() => setOpen(false), open);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-1 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-sm font-bold text-ink"
      >
        {t("button")} <ArrowRight size={15} />
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t("title")}
              className="w-full max-w-sm rounded-3xl border-2 border-ink/15 bg-white p-6 shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-center text-xl font-extrabold text-ink">{t("title")}</h2>
              <p className="mt-1 text-center text-sm font-medium text-muted">{t("subtitle")}</p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link
                  href="/vibes"
                  className="rounded-2xl border-2 border-ink/10 bg-white px-3 py-5 text-center transition-transform hover:-translate-y-0.5 hover:border-flockie-coral/50"
                >
                  <span className="block text-2xl">🎉</span>
                  <span className="mt-1 block text-sm font-extrabold text-ink">{t("vibes")}</span>
                  <span className="block text-[11px] font-medium text-muted">{t("vibesSub")}</span>
                </Link>
                <Link
                  href="/match?view=browse"
                  className="rounded-2xl border-2 border-ink/10 bg-white px-3 py-5 text-center transition-transform hover:-translate-y-0.5 hover:border-flockie-blue/60"
                >
                  <span className="block text-2xl">🤝</span>
                  <span className="mt-1 block text-sm font-extrabold text-ink">{t("activities")}</span>
                  <span className="block text-[11px] font-medium text-muted">{t("activitiesSub")}</span>
                </Link>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-4 block w-full text-center text-sm font-bold text-muted underline"
              >
                {t("cancel")}
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
