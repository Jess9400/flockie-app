"use client";

import { useState } from "react";

export default function PhotoStrip({ photos }: { photos: string[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (photos.length === 0) return null;

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {photos.map((url) => (
          <button
            key={url}
            type="button"
            onClick={() => setOpen(url)}
            className="h-[120px] shrink-0 overflow-hidden rounded-xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-auto object-cover" />
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/85 p-6"
          onClick={() => setOpen(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={open}
            alt=""
            className="max-h-[90vh] max-w-full rounded-2xl object-contain"
          />
        </div>
      )}
    </>
  );
}
