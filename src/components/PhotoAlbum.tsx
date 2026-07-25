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
  const stripRef = useRef<HTMLDivElement>(null);
  const open = idx !== null;

  // Advance the strip by one pair; wrap back to the start at the end.
  function nudge() {
    const el = stripRef.current;
    if (!el) return;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
    el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + el.clientWidth, behavior: "smooth" });
  }

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

  return (
    <div className={className}>
      <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-flockie-coral">{t("photosHeading")}</p>
      {/* 2-up carousel — swipe/scroll or tap the arrow for more; keeps the card short. */}
      <div className="relative">
        <div
          ref={stripRef}
          className="flex gap-2 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setIdx(i)}
              className="group relative aspect-square w-[calc(50%-0.25rem)] shrink-0 snap-start overflow-hidden rounded-2xl border border-ink/12 bg-cream"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
            </button>
          ))}
        </div>
        {photos.length > 2 && (
          <button
            type="button"
            onClick={nudge}
            aria-label={t("nextPhoto")}
            className="absolute right-1.5 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-ink/10 bg-white/90 text-navy shadow-[0_2px_8px_rgba(10,37,69,0.15)] backdrop-blur hover:bg-white"
          >
            <ChevronRight size={18} />
          </button>
        )}
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
