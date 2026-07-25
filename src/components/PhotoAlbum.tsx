"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";

// A collage of profile photos that opens into a swipeable full-screen viewer.
export default function PhotoAlbum({ photos, className }: { photos: string[]; className?: string }) {
  const t = useTranslations("profile.story");
  const [idx, setIdx] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const touchX = useRef<number | null>(null);
  const open = idx !== null;

  useEffect(() => setMounted(true), []);

  const go = useCallback(
    (delta: number) => setIdx((i) => (i === null ? i : (i + delta + photos.length) % photos.length)),
    [photos.length]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIdx(null);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  if (!photos.length) return null;

  // Collage: hero the first, tile the rest — keeps it cute at any count.
  return (
    <div className={className}>
      <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-flockie-coral">{t("photosHeading")}</p>
      <div className="grid grid-cols-2 gap-2">
        {photos.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setIdx(i)}
            className={`group relative overflow-hidden rounded-2xl border border-ink/12 bg-cream ${
              photos.length % 2 === 1 && i === 0 ? "col-span-2 aspect-[16/10]" : "aspect-square"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
          </button>
        ))}
      </div>

      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
            onClick={() => setIdx(null)}
            onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchX.current === null) return;
              const dx = e.changedTouches[0].clientX - touchX.current;
              if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
              touchX.current = null;
            }}
          >
            <button
              type="button"
              onClick={() => setIdx(null)}
              aria-label={t("close")}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
            >
              <X size={20} />
            </button>

            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); go(-1); }}
                  aria-label={t("prevPhoto")}
                  className="absolute left-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:left-6"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); go(1); }}
                  aria-label={t("nextPhoto")}
                  className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:right-6"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[idx!]}
              alt=""
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain"
            />

            {photos.length > 1 && (
              <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
                {idx! + 1} / {photos.length}
              </span>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
