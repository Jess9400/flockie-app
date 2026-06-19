"use client";

import { useEffect, useState } from "react";

type Og = { url: string; title: string | null; image: string | null; price: string | null; siteName: string | null };

export default function LinkPreview({ url }: { url: string }) {
  const [og, setOg] = useState<Og | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/og?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (d?.title) setOg(d);
        else setFailed(true);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [url]);

  if (failed || !og) return null;

  return (
    <a
      href={og.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 block max-w-[280px] overflow-hidden rounded-2xl border-2 border-navy bg-white"
    >
      {og.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={og.image} alt="" className="h-32 w-full object-cover" />
      )}
      <div className="p-2.5">
        <p className="font-nunito text-[11px] font-semibold uppercase tracking-wide text-navy/50">
          {og.siteName}
        </p>
        <p className="line-clamp-2 font-nunito text-sm font-bold text-navy">{og.title}</p>
        {og.price && (
          <p className="mt-0.5 font-fredoka text-sm font-semibold text-flockie-coral">{og.price}</p>
        )}
      </div>
    </a>
  );
}
