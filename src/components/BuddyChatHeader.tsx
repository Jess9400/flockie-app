"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, MoreVertical, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ProfilePeek, { type PeekData } from "@/components/ProfilePeek";

export default function BuddyChatHeader({
  matchId,
  name,
  age,
  photo,
  otherCity,
  destination,
  dateRange,
  score,
  sharedVibe,
  sharedTravelStyle,
  compatLine,
  peek,
}: {
  matchId: string;
  name: string;
  age: number | null;
  photo: string | null;
  otherCity: string | null;
  destination: string | null;
  dateRange: string | null;
  score: number | null;
  sharedVibe: string[];
  sharedTravelStyle: string[];
  compatLine: string | null;
  peek: PeekData;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [expanded, setExpanded] = useState(false);
  const [menu, setMenu] = useState(false);
  const [showPeek, setShowPeek] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function leave() {
    if (!window.confirm(`Leave this match? You'll lose access to this chat and ${name} will be notified.`))
      return;
    setLeaving(true);
    await supabase.from("buddy_matches").delete().eq("id", matchId);
    router.push("/chats");
    router.refresh();
  }

  return (
    <div className="sticky top-16 z-20 -mx-5 border-b-2 border-navy bg-white px-5">
      {/* top row */}
      <div className="flex items-center justify-between pt-3">
        <Link href="/chats" className="flex items-center gap-1 font-nunito text-sm font-bold text-navy/60">
          <ChevronLeft size={16} /> Chats
        </Link>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            aria-label="Menu"
            className="flex h-8 w-8 items-center justify-center rounded-full text-navy hover:bg-navy/5"
          >
            <MoreVertical size={18} />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-40 mt-1 w-52 rounded-2xl border-2 border-navy bg-white p-1.5 font-nunito text-sm font-semibold text-navy shadow-[0_4px_0_rgba(10,37,69,0.15)]">
                <Link href={`/people/${peek.id}`} className="block rounded-xl px-3 py-2 hover:bg-navy/5">
                  View {name}&rsquo;s profile
                </Link>
                <button type="button" onClick={() => { setMenu(false); setExpanded(true); }} className="block w-full rounded-xl px-3 py-2 text-left hover:bg-navy/5">
                  View trip details
                </button>
                <a
                  href={`mailto:hello@findflockie.com?subject=Report%20user%20${encodeURIComponent(name)}`}
                  className="block rounded-xl px-3 py-2 hover:bg-navy/5"
                >
                  Report this user
                </a>
                <button type="button" onClick={leave} disabled={leaving} className="block w-full rounded-xl px-3 py-2 text-left text-flockie-coral hover:bg-navy/5">
                  Leave this match
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* context card */}
      <div className="flex items-start gap-3 py-3">
        <button type="button" onClick={() => setShowPeek(true)} aria-label={`${name}'s profile`} className="shrink-0">
          {photo ? (
            <Image src={photo} alt="" width={56} height={56} className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-flockie-blue text-lg font-bold text-white">
              {name[0]?.toUpperCase()}
            </span>
          )}
        </button>

        <button type="button" onClick={() => setExpanded((v) => !v)} className="min-w-0 flex-1 text-left">
          <p className="font-fredoka text-lg font-semibold text-navy">
            {name}{age ? `, ${age}` : ""}
          </p>
          {destination && (
            <p className="font-nunito text-sm font-medium text-navy/80">
              📍 {otherCity ? `${otherCity} → ` : ""}{destination}
            </p>
          )}
          {dateRange && (
            <p className="font-nunito text-sm font-medium text-navy/80">📅 {dateRange}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {score != null && (
              <span className="rounded-full bg-flockie-blue px-2.5 py-0.5 font-nunito text-xs font-bold text-white">
                ✨ {score}% your vibe
              </span>
            )}
            {sharedVibe.slice(0, 3).map((t) => (
              <span key={t} className="font-nunito text-xs font-medium text-navy/60">
                {t}
              </span>
            ))}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Collapse" : "Expand"}
          className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-navy"
        >
          <ChevronDown size={18} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* expanded details */}
      {expanded && (
        <div className="space-y-3 pb-4">
          {compatLine && (
            <p className="font-nunito text-sm font-medium text-navy/80">{compatLine}</p>
          )}
          {(sharedVibe.length > 0 || sharedTravelStyle.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {[...sharedVibe, ...sharedTravelStyle].map((t) => (
                <span key={t} className="rounded-full bg-flockie-coral px-3 py-1.5 font-nunito text-xs font-semibold text-white">
                  {t}
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Link
              href={`/people/${peek.id}`}
              className="rounded-full border-2 border-navy bg-flockie-blue px-4 py-1.5 font-fredoka text-sm font-semibold text-white"
            >
              View {name}&rsquo;s full profile
            </Link>
            <button
              type="button"
              onClick={leave}
              disabled={leaving}
              className="rounded-full border-2 border-navy bg-white px-4 py-1.5 font-fredoka text-sm font-semibold text-navy disabled:opacity-50"
            >
              {leaving ? "Leaving…" : "Leave match"}
            </button>
          </div>
        </div>
      )}

      {showPeek && <ProfilePeek data={peek} onClose={() => setShowPeek(false)} />}
    </div>
  );
}
