"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, MapPin, CalendarClock, Users, X, MoreVertical } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import BrandedMap from "@/components/BrandedMap";
import { useConfirm } from "@/components/ui/feedback";
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
  timeZone,
  locationLabel,
  mapSrc,
  description,
  bookingUrl,
  members,
  chatId,
  initialMuted = false,
}: {
  vibeId: string;
  title: string;
  cover: string | null;
  startsAt: string | null;
  timeZone?: string | null;
  locationLabel: string;
  mapSrc: string | null;
  description: string | null;
  bookingUrl: string | null;
  members: ChatMember[];
  chatId: string;
  initialMuted?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const confirm = useConfirm();
  const t = useTranslations("buddies");
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);
  const [panel, setPanel] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [menu, setMenu] = useState(false);
  const [muted, setMuted] = useState(initialMuted);

  async function toggleMute() {
    setMenu(false);
    const { data } = await supabase.rpc("toggle_chat_mute", { p_chat: chatId });
    setMuted(!!data);
  }

  const shown = members.slice(0, 5);
  const extra = members.length - shown.length;

  async function leave() {
    if (
      !(await confirm({
        title: t("vibeHeader.leaveVibeTitle"),
        message: t("vibeHeader.leaveVibeMsg"),
        confirmLabel: t("shared.leave"),
        destructive: true,
      }))
    )
      return;
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
    <div className="z-20 -mx-5 shrink-0 border-b border-navy/12 bg-cream px-5">
      {/* Back to the chat list - mobile only. On desktop the list rail is
          always beside the thread, so a back link there is redundant. */}
      <Link
        href="/chats"
        className="flex items-center gap-1 pt-3 font-nunito text-sm font-bold text-navy/60 lg:hidden"
      >
        <ChevronLeft size={16} /> {t("shared.chats")}
      </Link>
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
            {startsAt ? formatVibeWhen(startsAt, locale, timeZone) : ""}
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
            aria-label={t("shared.members")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-navy/15 text-navy"
          >
            <Users size={16} />
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? t("shared.collapse") : t("shared.expand")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-navy/15 text-navy"
          >
            <ChevronDown
              size={18}
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              aria-label={t("shared.menu")}
              className="flex h-9 w-9 items-center justify-center rounded-full text-navy hover:bg-navy/5"
            >
              <MoreVertical size={18} />
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
                <div className="absolute right-0 z-40 mt-1 w-52 rounded-2xl border border-navy/15 bg-white p-1.5 font-nunito text-sm font-semibold text-navy shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
                  <button
                    type="button"
                    onClick={() => { setMenu(false); setExpanded(true); }}
                    className="block w-full rounded-xl px-3 py-2 text-left hover:bg-navy/5"
                  >
                    {t("shared.viewDetails")}
                  </button>
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="block w-full rounded-xl px-3 py-2 text-left hover:bg-navy/5"
                  >
                    {muted ? t("shared.muteOff") : t("shared.muteOn")}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMenu(false); leave(); }}
                    disabled={leaving}
                    className="block w-full rounded-xl px-3 py-2 text-left text-flockie-coral hover:bg-navy/5"
                  >
                    {t("vibeHeader.leaveVibe")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="max-h-[55vh] space-y-3 overflow-y-auto pb-4">
          {startsAt && (
            <p className="flex items-center gap-1.5 font-nunito text-sm font-medium text-navy">
              <CalendarClock size={15} className="text-flockie-coral" />
              {formatVibeWhen(startsAt, locale, timeZone)}
            </p>
          )}
          <p className="flex items-center gap-1.5 font-nunito text-sm font-medium text-navy">
            <MapPin size={15} className="text-flockie-coral" />
            {locationLabel || t("vibeHeader.locationTBD")}
          </p>
          {description && (
            <p className="font-nunito text-sm font-normal text-navy/80">{description}</p>
          )}
          {mapSrc &&
            (GMAPS_KEY ? (
              <BrandedMap apiKey={GMAPS_KEY} location={locationLabel} fallbackSrc={mapSrc} />
            ) : (
              <iframe
                title={t("vibeHeader.mapTitle")}
                src={mapSrc}
                loading="lazy"
                className="h-[150px] w-full rounded-2xl border border-navy/15"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ))}
          {bookingUrl && (
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-full border border-navy/15 bg-flockie-coral py-3 font-fredoka text-sm font-semibold text-white"
            >
              {t("shared.bookSpot")}
            </a>
          )}
          <button
            type="button"
            onClick={leave}
            disabled={leaving}
            className="rounded-full border border-navy/15 bg-white px-4 py-1.5 font-fredoka text-sm font-semibold text-navy disabled:opacity-50"
          >
            {leaving ? t("shared.leaving") : t("vibeHeader.leaveVibe")}
          </button>
        </div>
      )}

      {/* Members slide-out panel */}
      {panel && (
        <>
          <div className="fixed inset-0 z-40 bg-navy/30" onClick={() => setPanel(false)} />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-72 flex-col border-l border-navy/12 bg-cream p-4">
            <div className="flex items-center justify-between">
              <p className="font-fredoka text-lg font-semibold text-navy">
                {t("vibeHeader.membersCount", { count: members.length })}
              </p>
              <button
                type="button"
                onClick={() => setPanel(false)}
                aria-label={t("shared.close")}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-navy/15 text-navy"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
              {members.map((m) => (
                <Link
                  key={m.id}
                  href={`/people/${m.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-navy/15 bg-white p-2"
                >
                  <Avatar m={m} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-nunito text-sm font-bold text-navy">
                        {m.name}
                      </span>
                      {m.isHost && (
                        <span className="rounded-full bg-flockie-coral px-1.5 py-0.5 font-nunito text-[10px] font-bold text-white">
                          {t("vibeHeader.host")}
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
              className="mt-3 rounded-full border border-navy/15 bg-white py-2 font-fredoka text-sm font-semibold text-navy disabled:opacity-50"
            >
              {leaving ? t("shared.leaving") : t("vibeHeader.leaveVibe")}
            </button>
          </aside>
        </>
      )}
    </div>
  );
}
