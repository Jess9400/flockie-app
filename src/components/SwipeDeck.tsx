"use client";

import { useState } from "react";
import Image from "next/image";
import { X, Heart, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Candidate = {
  id: string;
  display_name: string | null;
  age: number | null;
  photos: string[] | null;
  one_liner: string | null;
  trip_vibe: string[] | null;
  home_city: string | null;
};

export default function SwipeDeck({ candidates }: { candidates: Candidate[] }) {
  const supabase = createClient();
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [matchName, setMatchName] = useState<string | null>(null);

  const c = candidates[i];

  async function act(liked: boolean) {
    if (!c || busy) return;
    setBusy(true);
    const { data } = await supabase.rpc("buddy_swipe", {
      p_target: c.id,
      p_liked: liked,
    });
    setBusy(false);
    if (liked && data === true) setMatchName(c.display_name || "this flockie");
    setI((n) => n + 1);
  }

  if (!c) {
    return (
      <div className="mt-6 flex h-[55vh] items-center justify-center rounded-3xl border-2 border-dashed border-ink/30 px-8 text-center font-medium text-muted">
        You&rsquo;re all caught up. Check back soon for new flockies in your city.
      </div>
    );
  }

  const cover = c.photos?.[0];

  return (
    <div className="mt-6">
      <div className="relative h-[60vh] overflow-hidden rounded-3xl border-2 border-ink bg-cream shadow-[0_6px_0_0_rgba(26,26,26,1)]">
        {cover ? (
          <Image src={cover} alt="" fill sizes="500px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl">🕊️</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/0 to-black/0" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <p className="text-2xl font-black">
            {c.display_name || "Flockie"}
            {c.age ? `, ${c.age}` : ""}
          </p>
          {c.home_city && (
            <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold">
              <MapPin size={14} /> {c.home_city}
            </p>
          )}
          {c.one_liner && (
            <p className="mt-1 text-sm font-medium text-white/90">{c.one_liner}</p>
          )}
          {(c.trip_vibe?.length ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.trip_vibe!.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-bold backdrop-blur-sm"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-6">
        <button
          onClick={() => act(false)}
          disabled={busy}
          aria-label="Pass"
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink bg-white text-ink disabled:opacity-50"
        >
          <X size={26} />
        </button>
        <button
          onClick={() => act(true)}
          disabled={busy}
          aria-label="Like"
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-ink bg-flockie-orange text-white shadow-[0_4px_0_0_#E0512C] disabled:opacity-50"
        >
          <Heart size={28} fill="currentColor" />
        </button>
      </div>

      {matchName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-6" onClick={() => setMatchName(null)}>
          <div className="w-full max-w-sm rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-[0_8px_0_0_rgba(26,26,26,1)]">
            <p className="text-3xl font-black">It&rsquo;s a match! 🎉</p>
            <p className="mt-2 font-medium text-ink/70">
              You and {matchName} both liked each other.
            </p>
            <button
              onClick={() => setMatchName(null)}
              className="mt-5 w-full rounded-full border-2 border-ink bg-flockie-orange py-3 font-bold text-white shadow-[0_4px_0_0_#E0512C]"
            >
              Keep swiping
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
