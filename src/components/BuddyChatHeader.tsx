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
  chatId,
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
  initialMuted,
  isGroup,
  groupTitle,
  groupMembers = [],
}: {
  matchId: string;
  chatId: string;
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
  initialMuted: boolean;
  isGroup?: boolean;
  groupTitle?: string;
  groupMembers?: { id: string; name: string; photo: string | null; isHost: boolean }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [expanded, setExpanded] = useState(false);
  const [menu, setMenu] = useState(false);
  const [showPeek, setShowPeek] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [muted, setMuted] = useState(initialMuted);

  async function leave() {
    if (!window.confirm(`Leave this match? You'll lose access to this chat and ${name} will be notified.`))
      return;
    setLeaving(true);
    await supabase.rpc("leave_buddy_match", { p_match: matchId });
    router.push("/chats");
    router.refresh();
  }

  async function toggleMute() {
    setMenu(false);
    const { data } = await supabase.rpc("toggle_chat_mute", { p_chat: chatId });
    setMuted(!!data);
  }

  async function report() {
    setMenu(false);
    const reason = window.prompt(`Report ${name}? Tell us what's wrong (optional):`);
    if (reason === null) return;
    await supabase.rpc("report_user", { p_target: peek.id, p_reason: reason });
    window.alert("Thanks — our team will review this report.");
  }

  async function makeFlock() {
    setMenu(false);
    if (
      !window.confirm(
        "Turn this trip into a Flock? It becomes a public group trip others can request to join — you and your buddy approve new members together."
      )
    )
      return;
    const { error } = await supabase.rpc("convert_match_to_flock", { p_match: matchId });
    if (error) return window.alert(error.message);
    window.alert("Done! Your trip is now a Flock. Approve join requests from this chat or My Trips.");
    router.refresh();
  }

  if (isGroup) {
    const shown = groupMembers.slice(0, 6);
    return (
      <div className="sticky top-16 z-20 -mx-5 border-b-2 border-navy bg-white px-5">
        <div className="flex items-center justify-between pt-3">
          <Link href="/chats" className="flex items-center gap-1 font-nunito text-sm font-bold text-navy/60">
            <ChevronLeft size={16} /> Chats
          </Link>
          <span className="rounded-full bg-flockie-orange px-2.5 py-0.5 font-nunito text-[11px] font-extrabold uppercase text-white">
            Flock
          </span>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-3 py-3 text-left"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cream text-2xl">🧳</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-fredoka text-lg font-semibold text-navy">{groupTitle || "Group trip"}</span>
            <span className="block truncate font-nunito text-sm font-medium text-navy/70">
              {groupMembers.length} going{dateRange ? ` · ${dateRange}` : ""}
            </span>
          </span>
          <ChevronDown size={18} className={`shrink-0 text-navy transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>

        <div className="-mt-1 flex items-center gap-1 pb-3">
          <div className="flex -space-x-2">
            {shown.map((m) => (
              <Link key={m.id} href={`/people/${m.id}`} aria-label={m.name}>
                {m.photo ? (
                  <Image src={m.photo} alt="" width={28} height={28} className="h-7 w-7 rounded-full border-2 border-white object-cover" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-flockie-blue text-[10px] font-bold text-white">
                    {m.name[0]}
                  </span>
                )}
              </Link>
            ))}
          </div>
          {groupMembers.length > shown.length && (
            <span className="ml-1 font-nunito text-xs font-medium text-navy/60">+{groupMembers.length - shown.length}</span>
          )}
        </div>

        {expanded && (
          <div className="space-y-2 pb-4">
            {dateRange && <p className="font-nunito text-sm font-medium text-navy">📅 {dateRange}</p>}
            <p className="font-nunito text-xs font-bold uppercase tracking-wide text-navy/55">Members</p>
            <div className="flex flex-wrap gap-2">
              {groupMembers.map((m) => (
                <Link
                  key={m.id}
                  href={`/people/${m.id}`}
                  className="flex items-center gap-1.5 rounded-full border-2 border-navy bg-white px-2 py-1 font-nunito text-xs font-bold text-navy"
                >
                  {m.photo ? (
                    <Image src={m.photo} alt="" width={20} height={20} className="h-5 w-5 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-flockie-blue text-[10px] font-bold text-white">
                      {m.name[0]}
                    </span>
                  )}
                  {m.name}
                  {m.isHost && <span className="text-flockie-coral">★</span>}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    );
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
                <button type="button" onClick={makeFlock} className="block w-full rounded-xl px-3 py-2 text-left hover:bg-navy/5">
                  Turn this into a Flock
                </button>
                <button type="button" onClick={toggleMute} className="block w-full rounded-xl px-3 py-2 text-left hover:bg-navy/5">
                  {muted ? "Unmute notifications" : "Mute notifications"}
                </button>
                <button type="button" onClick={report} className="block w-full rounded-xl px-3 py-2 text-left hover:bg-navy/5">
                  Report this user
                </button>
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
