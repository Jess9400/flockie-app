"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, Heart, MapPin, CalendarClock, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Stars from "@/components/Stars";

type Candidate = {
  id: string;
  display_name: string | null;
  age: number | null;
  photos: string[] | null;
  video_url: string | null;
  one_liner: string | null;
  title: string | null;
  destinations: string[] | null;
  start_date: string | null;
  end_date: string | null;
  trip_type: string[] | null;
  score?: number | null;
  rating?: number | null;
  review_count?: number;
};

export default function SwipeDeck({ candidates }: { candidates: Candidate[] }) {
  const supabase = createClient();
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [media, setMedia] = useState(0);
  const [match, setMatch] = useState<{ name: string; chatId: string } | null>(null);
  const [drag, setDrag] = useState(0);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const movedRef = useRef(false);
  const [animating, setAnimating] = useState(false);
  const SWIPE_THRESHOLD = 110;

  const c = candidates[i];

  function onPointerDown(e: React.PointerEvent) {
    if (busy || animating) return;
    draggingRef.current = true;
    startXRef.current = e.clientX;
    movedRef.current = false;
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    const dx = e.clientX - startXRef.current;
    if (Math.abs(dx) > 8) movedRef.current = true;
    setDrag(dx);
  }
  function endDrag() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (Math.abs(drag) > SWIPE_THRESHOLD) {
      const liked = drag > 0;
      setAnimating(true);
      setDrag(liked ? 700 : -700);
      setTimeout(() => {
        act(liked);
        setDrag(0);
        setAnimating(false);
      }, 180);
    } else {
      setDrag(0);
    }
  }

  // photos + (optional) video
  const items = c
    ? [
        ...(c.photos ?? []).map((url) => ({ type: "img" as const, url })),
        ...(c.video_url ? [{ type: "video" as const, url: c.video_url }] : []),
      ]
    : [];

  async function act(liked: boolean) {
    if (!c || busy) return;
    setBusy(true);
    const { data } = await supabase.rpc("buddy_swipe", { p_target: c.id, p_liked: liked });
    setBusy(false);
    const res = data as { matched: boolean; chat_id?: string } | null;
    if (liked && res?.matched && res.chat_id) {
      setMatch({ name: c.display_name || "this flockie", chatId: res.chat_id });
    }
    setMedia(0);
    setI((n) => n + 1);
  }

  if (!c) {
    return (
      <div className="mt-6 flex h-[55vh] items-center justify-center rounded-3xl border-2 border-dashed border-ink/30 px-8 text-center font-medium text-muted">
        You&rsquo;re all caught up. Check back as more travelers post this trip.
      </div>
    );
  }

  const cur = items[media];

  return (
    <div className="mt-6">
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        style={{
          transform: `translateX(${drag}px) rotate(${drag / 18}deg)`,
          transition: draggingRef.current ? "none" : "transform 0.18s ease-out",
          touchAction: "pan-y",
        }}
        className="relative h-[60vh] select-none overflow-hidden rounded-3xl border-2 border-ink bg-cream shadow-[0_6px_0_0_rgba(26,26,26,1)]"
      >
        {/* swipe overlays */}
        {drag > 0 && (
          <span
            style={{ opacity: Math.min(drag / SWIPE_THRESHOLD, 1) }}
            className="absolute left-4 top-4 z-20 -rotate-12 rounded-xl border-4 border-[#06D6A0] px-3 py-1 text-2xl font-black text-[#06D6A0]"
          >
            LIKE
          </span>
        )}
        {drag < 0 && (
          <span
            style={{ opacity: Math.min(-drag / SWIPE_THRESHOLD, 1) }}
            className="absolute right-4 top-4 z-20 rotate-12 rounded-xl border-4 border-flockie-orange px-3 py-1 text-2xl font-black text-flockie-orange"
          >
            NOPE
          </span>
        )}
        {cur?.type === "video" ? (
          <video src={cur.url} controls playsInline className="h-full w-full object-cover" />
        ) : cur?.type === "img" ? (
          <Image src={cur.url} alt="" fill sizes="500px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl">🕊️</div>
        )}

        {/* media dots */}
        {items.length > 1 && (
          <div className="absolute inset-x-0 top-2 flex justify-center gap-1.5 px-4">
            {items.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 flex-1 rounded-full ${idx === media ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
        )}

        {/* prev / next */}
        {items.length > 1 && (
          <>
            <button
              onClick={() => setMedia((m) => (m - 1 + items.length) % items.length)}
              aria-label="Previous"
              className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border-2 border-ink bg-white/85 text-ink"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setMedia((m) => (m + 1) % items.length)}
              aria-label="Next"
              className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border-2 border-ink bg-white/85 text-ink"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/0 to-black/0" />

        {/* tap info → full profile (suppressed after a drag) */}
        <Link
          href={`/people/${c.id}`}
          onClick={(e) => {
            if (movedRef.current) e.preventDefault();
          }}
          className="absolute inset-x-0 bottom-0 p-5 text-white"
        >
          <p className="flex items-center gap-1.5 text-2xl font-black">
            {c.display_name || "Flockie"}
            {c.age ? `, ${c.age}` : ""}
            <ChevronsUpDown size={18} className="rotate-90 opacity-80" />
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {typeof c.score === "number" && (
              <span className="rounded-full bg-flockie-blue px-2.5 py-0.5 text-xs font-bold text-white">
                ✨ {Math.round(c.score)}% match
              </span>
            )}
            {typeof c.rating === "number" && (c.review_count ?? 0) > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-bold backdrop-blur-sm">
                <Stars value={c.rating} size={12} /> {c.rating.toFixed(1)} ({c.review_count})
              </span>
            )}
          </div>
          {c.title && (
            <p className="mt-0.5 text-sm font-bold text-flockie-orange">🎯 {c.title}</p>
          )}
          {(c.destinations?.length ?? 0) > 0 && (
            <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold">
              <MapPin size={14} /> {c.destinations!.join(" · ")}
            </p>
          )}
          {c.start_date && c.end_date && (
            <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-white/90">
              <CalendarClock size={13} /> {c.start_date} → {c.end_date}
            </p>
          )}
          {c.one_liner && <p className="mt-1 text-sm font-medium text-white/90">{c.one_liner}</p>}
          <span className="mt-2 inline-block rounded-full bg-white/25 px-3 py-1 text-xs font-bold backdrop-blur-sm">
            Tap to view full profile
          </span>
        </Link>
      </div>

      <div className="mt-4 flex items-center justify-center gap-6">
        <button onClick={() => act(false)} disabled={busy} aria-label="Pass"
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink bg-white text-ink disabled:opacity-50">
          <X size={26} />
        </button>
        <button onClick={() => act(true)} disabled={busy} aria-label="Like"
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-ink bg-flockie-orange text-white shadow-[0_4px_0_0_#E0512C] disabled:opacity-50">
          <Heart size={28} fill="currentColor" />
        </button>
      </div>

      {match && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-6">
          <div className="w-full max-w-sm rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-[0_8px_0_0_rgba(26,26,26,1)]">
            <p className="text-3xl font-black">It&rsquo;s a match! 🎉</p>
            <p className="mt-2 font-medium text-ink/70">
              You and {match.name} both want to go. Say hi and plan it.
            </p>
            <Link href={`/buddies/${match.chatId}`}
              className="mt-5 block rounded-full border-2 border-ink bg-flockie-orange py-3 font-bold text-white shadow-[0_4px_0_0_#E0512C]">
              Say hi 👋
            </Link>
            <button onClick={() => setMatch(null)} className="mt-2 w-full py-2 text-center text-sm font-bold text-muted">
              Keep swiping
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
