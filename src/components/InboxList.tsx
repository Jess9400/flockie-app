"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: { vibe_id?: string; like_from?: string; chat_id?: string; href?: string } | null;
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

export default function InboxList({ notifications }: { notifications: Notif[] }) {
  const supabase = createClient();
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
        Nothing yet. Invitations and updates will show up here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visibleNotifications.map((n) => {
        const vibeId = n.data?.vibe_id;
        const href = n.data?.href
          ? n.data.href
          : vibeId
            ? `/vibes/${vibeId}`
            : n.data?.chat_id
              ? `/buddies/${n.data.chat_id}`
              : n.data?.like_from
                ? `/people/${n.data.like_from}`
                : null;
        const card = (
          <div
            className={`rounded-2xl border-2 p-4 ${STYLE[n.type] ?? "border-ink/15 bg-white"} ${
              !n.read_at ? "shadow-[0_3px_0_0_rgba(26,26,26,1)]" : ""
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold">{n.title}</p>
                {n.body && <p className="mt-0.5 text-sm font-medium text-ink/70">{n.body}</p>}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
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
                {n.type === "vibe_invitation" ? "View & confirm →" : "Open →"}
              </Link>
            )}
          </div>
        );
        return <div key={n.id}>{card}</div>;
      })}
    </div>
  );
}
