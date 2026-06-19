"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, MapPin, CalendarClock, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import BrandedMap from "@/components/BrandedMap";
import { formatVibeWhen } from "@/lib/vibes";

const GMAPS_KEY = process.env.NEXT_PUBLIC_GMAPS_KEY;

export type ChatMember = {
  id: string;
  name: string;
  photo: string | null;
  age: number | null;
  city: string | null;
  isHost: boolean;
};

export default function VibeChatHeader({
  vibeId,
  title,
  cover,
  startsAt,
  locationLabel,
  mapSrc,
  description,
  bookingUrl,
  members,
}: {
  vibeId: string;
  title: string;
  cover: string | null;
  startsAt: string | null;
  locationLabel: string;
  mapSrc: string | null;
  description: string | null;
  bookingUrl: string | null;
  members: ChatMember[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [expanded, setExpanded] = useState(false);
  const [panel, setPanel] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const shown = members.slice(0, 5);
  const extra = members.length - shown.length;

  async function leave() {
    if (!window.confirm("Leave this Vibe? You'll lose your spot and the chat.")) return;
    setLeaving(true);
    await supabase.rpc("leave_vibe", { p_vibe: vibeId });
    router.push("/chats");
    router.refresh();
  }

  function Avatar({ m, size = 28 }: { m: ChatMember; size?: number }) {
    return m.photo ? (
      <Image
        src={m.photo}
        alt=""
        width={size}
        height={size}
        className="rounded-full border-2 border-white object-cover"
        style={{ height: size, width: size }}
      />
    ) : (
      <span
        className="flex items-center justify-center rounded-full border-2 border-white bg-flockie-blue text-xs font-bold text-white"
        style={{ height: size, width: size }}
      >
        {m.name[0]?.toUpperCase()}
      </span>
    );
  }

  return (
    <div className="sticky top-16 z-20 -mx-5 border-b-2 border-navy bg-cream px-5">
      {/* Collapsed bar */}
      <div className="flex items-center gap-3 py-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-cream">
          {cover ? (
            <Image src={cover} alt="" fill sizes="64px" className="object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-2xl">🎟️</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate font-fredoka text-lg font-semibold text-navy">{title}</p>
          <p className="truncate font-nunito text-sm font-medium text-navy/70">
            {startsAt ? formatVibeWhen(startsAt) : ""}
            {locationLabel ? ` · ${locationLabel}` : ""}
          </p>
          <div className="mt-1 flex items-center">
            <div className="flex -space-x-2">
              {shown.map((m) => (
                <Avatar key={m.id} m={m} />
              ))}
            </div>
            {extra > 0 && (
              <span className="ml-2 font-nunito text-xs font-medium text-navy/60">+{extra}</span>
            )}
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setPanel(true)}
            aria-label="Members"
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-navy text-navy"
          >
            <Users size={16} />
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Collapse" : "Expand"}
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-navy text-navy"
          >
            <ChevronDown
              size={18}
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="space-y-3 pb-4">
          {cover && (
            <div className="relative h-44 w-full overflow-hidden rounded-2xl">
              <Image src={cover} alt="" fill sizes="100vw" className="object-cover" />
            </div>
          )}
          {startsAt && (
            <p className="flex items-center gap-1.5 font-nunito text-sm font-medium text-navy">
              <CalendarClock size={15} className="text-flockie-coral" />
              {formatVibeWhen(startsAt)}
            </p>
          )}
          <p className="flex items-center gap-1.5 font-nunito text-sm font-medium text-navy">
            <MapPin size={15} className="text-flockie-coral" />
            {locationLabel || "Location TBD"}
          </p>
          {description && (
            <p className="font-nunito text-sm font-normal text-navy/80">{description}</p>
          )}
          {mapSrc &&
            (GMAPS_KEY ? (
              <BrandedMap apiKey={GMAPS_KEY} location={locationLabel} fallbackSrc={mapSrc} />
            ) : (
              <iframe
                title="Event location"
                src={mapSrc}
                loading="lazy"
                className="h-[250px] w-full rounded-2xl border-2 border-navy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ))}
          {bookingUrl && (
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-navy bg-flockie-coral py-3 font-fredoka text-sm font-semibold text-white"
            >
              🎟️ Book your spot →
            </a>
          )}
          <button
            type="button"
            onClick={leave}
            disabled={leaving}
            className="rounded-full border-2 border-navy bg-white px-4 py-1.5 font-fredoka text-sm font-semibold text-navy disabled:opacity-50"
          >
            {leaving ? "Leaving…" : "Leave Vibe"}
          </button>
        </div>
      )}

      {/* Members slide-out panel */}
      {panel && (
        <>
          <div className="fixed inset-0 z-40 bg-navy/30" onClick={() => setPanel(false)} />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-72 flex-col border-l-2 border-navy bg-cream p-4">
            <div className="flex items-center justify-between">
              <p className="font-fredoka text-lg font-semibold text-navy">
                Members ({members.length})
              </p>
              <button
                type="button"
                onClick={() => setPanel(false)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-navy text-navy"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
              {members.map((m) => (
                <Link
                  key={m.id}
                  href={`/people/${m.id}`}
                  className="flex items-center gap-3 rounded-2xl border-2 border-navy bg-white p-2"
                >
                  <Avatar m={m} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-nunito text-sm font-bold text-navy">
                        {m.name}
                      </span>
                      {m.isHost && (
                        <span className="rounded-full bg-flockie-coral px-1.5 py-0.5 font-nunito text-[10px] font-bold text-white">
                          Host
                        </span>
                      )}
                    </span>
                    <span className="block truncate font-nunito text-xs font-medium text-navy/60">
                      {[m.age, m.city].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
            <button
              type="button"
              onClick={leave}
              disabled={leaving}
              className="mt-3 rounded-full border-2 border-navy bg-white py-2 font-fredoka text-sm font-semibold text-navy disabled:opacity-50"
            >
              {leaving ? "Leaving…" : "Leave Vibe"}
            </button>
          </aside>
        </>
      )}
    </div>
  );
}
