"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: {
    vibe_id?: string;
    trip_id?: string;
    like_from?: string;
    chat_id?: string;
    href?: string;
    count?: number;
  } | null;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
};

const STYLE: Record<string, string> = {
  vibe_invitation: "border-flockie-orange bg-flockie-orange/10",
  vibe_confirmed: "border-[#06D6A0] bg-[#06D6A0]/10",
  vibe_standby: "border-ink/15 bg-cream",
  vibe_removed: "border-ink/15 bg-cream",
  vibe_removal_appeal: "border-flockie-blue bg-flockie-blue/10",
  vibing_message: "border-flockie-blue bg-flockie-blue/10",
  vibe_recommendation: "border-flockie-blue bg-flockie-blue/10",
  activity_like: "border-flockie-orange bg-flockie-orange/10",
  buddy_match: "border-[#06D6A0] bg-[#06D6A0]/10",
};

export default function InboxList({
  notifications,
  titles = {},
}: {
  notifications: Notif[];
  titles?: Record<string, string>;
}) {
  const supabase = createClient();
  const t = useTranslations("inbox");
  const [visibleNotifications, setVisibleNotifications] = useState(notifications);

  // Mark everything read when the inbox opens.
  useEffect(() => {
    const unread = visibleNotifications.filter((n) => !n.read_at).map((n) => n.id);
    if (unread.length === 0) return;
    supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", unread)
      .then(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function dismissNotification(id: string) {
    setVisibleNotifications((current) => current.filter((n) => n.id !== id));
    const { error } = await supabase
      .from("notifications")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      setVisibleNotifications((current) => {
        const dismissed = notifications.find((n) => n.id === id);
        return dismissed && !current.some((n) => n.id === id) ? [dismissed, ...current] : current;
      });
    }
  }

  if (visibleNotifications.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-ink/30 py-16 text-center font-medium text-muted">
        {t("empty")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visibleNotifications.map((n) => {
        const vibeId = n.data?.vibe_id;
        const tripId = n.data?.trip_id;
        const href = n.data?.href
          ? n.data.href
          : n.type === "flock_approved"
            ? n.data?.chat_id
              ? `/buddies/${n.data.chat_id}` // approved → straight into the flock chat
              : "/chats" // older notifications have no chat_id — the chat is in the list
            : n.type === "flock_declined"
              ? "/flocks" // declined → browse other flocks
              : n.type === "vibe_confirmed" && vibeId
                ? `/vibes/${vibeId}/chat` // confirmed → straight into the group chat
                : vibeId
                  ? `/vibes/${vibeId}`
                  : tripId
                    ? `/my-trips#trip-${tripId}` // flock join request → the trip to accept/reject
                    : n.data?.chat_id
                      ? `/buddies/${n.data.chat_id}`
                      : n.data?.like_from
                        ? `/people/${n.data.like_from}`
                        : null;
        const linkLabel =
          n.type === "flock_approved"
            ? t("openFlockChat")
            : n.type === "flock_declined"
              ? t("findAnotherFlock")
              : n.type === "vibe_invitation"
                ? t("viewConfirm")
                : n.type === "vibe_confirmed"
                  ? t("sayHi")
                  : tripId
                    ? t("openMyTrips")
                    : t("open");
        // Render the notification words in the viewer's language at display time,
        // keeping the specific Vibe / trip name when we have it. Legacy or unknown
        // types (no message key) fall back to the English text stored in the row.
        const resolvedTitle =
          (vibeId && titles[vibeId]) ||
          (tripId && titles[tripId]) ||
          (tripId ? t("fallbackTrip") : t("fallbackVibe"));
        const params = { title: resolvedTitle, count: n.data?.count ?? 0 };
        const titleKey = `types.${n.type}.title`;
        const bodyKey = `types.${n.type}.body`;
        const displayTitle = t.has(titleKey) ? t(titleKey, params) : n.title;
        const displayBody = t.has(bodyKey) ? t(bodyKey, params) : n.body;
        const card = (
          <div
            className={`rounded-2xl border-2 p-4 ${STYLE[n.type] ?? "border-ink/15 bg-white"} ${
              !n.read_at ? "shadow-[0_3px_0_0_rgba(26,26,26,1)]" : ""
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold">{displayTitle}</p>
                {displayBody && <p className="mt-0.5 text-sm font-medium text-ink/70">{displayBody}</p>}
              </div>
              <button
                type="button"
                aria-label={t("dismiss")}
                className="rounded-full px-2 py-0.5 text-lg font-black leading-none text-ink/45 hover:bg-white/70 hover:text-ink"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  dismissNotification(n.id);
                }}
              >
                ×
              </button>
            </div>
            {href && (
              <Link href={href} className="mt-2 inline-block text-sm font-bold text-flockie-orange">
                {linkLabel}
              </Link>
            )}
          </div>
        );
        return <div key={n.id}>{card}</div>;
      })}
    </div>
  );
}
