"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, X } from "lucide-react";

const KEY = "flockie_reviews_banner_dismissed";

// One consolidated, session-dismissible nudge for pending reviews (buddies +
// Vibes you attended). Server passes the aggregate count + a link to the first
// pending review. Renders nothing when there's nothing to review or once the
// viewer has dismissed it for this session.
export default function ReviewsToDoBanner({
  count,
  href,
}: {
  count: number;
  href: string;
}) {
  // Start hidden; a matching effect reveals it so we never flash on a dismissed
  // session or when SSR count is stale.
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (count <= 0) return;
    try {
      // Re-surface if the number of pending reviews has grown since dismissal.
      if (sessionStorage.getItem(KEY) !== String(count)) setShow(true);
    } catch {
      setShow(true);
    }
  }, [count]);

  function dismiss() {
    setShow(false);
    try {
      sessionStorage.setItem(KEY, String(count));
    } catch {
      /* ignore */
    }
  }

  if (!show || count <= 0) return null;

  return (
    <div
      role="status"
      className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border-2 border-ink bg-flockie-coral px-3 py-2.5 text-left text-white shadow-[0_3px_0_0_rgba(10,37,69,1)]"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-white text-ink">
        <Star size={16} className="fill-flockie-coral text-flockie-coral" />
      </span>
      <p className="flex-1 text-sm font-extrabold leading-snug">
        You have {count} review{count === 1 ? "" : "s"} to leave — help others find
        their people ⭐
      </p>
      <Link
        href={href}
        className="shrink-0 rounded-full border-2 border-ink bg-white px-3 py-1.5 text-xs font-extrabold text-ink"
      >
        {count === 1 ? "Leave it" : "Leave them"}
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss review reminder"
        className="shrink-0 rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
      >
        <X size={16} />
      </button>
    </div>
  );
}
