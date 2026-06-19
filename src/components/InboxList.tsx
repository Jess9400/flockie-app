"use client";

import { useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: { vibe_id?: string; like_from?: string; chat_id?: string } | null;
  read_at: string | null;
  created_at: string;
};

const STYLE: Record<string, string> = {
  vibe_invitation: "border-flockie-orange bg-flockie-orange/10",
  vibe_confirmed: "border-[#06D6A0] bg-[#06D6A0]/10",
  vibe_standby: "border-ink/15 bg-cream",
  vibing_message: "border-flockie-blue bg-flockie-blue/10",
  vibe_recommendation: "border-flockie-blue bg-flockie-blue/10",
  activity_like: "border-flockie-orange bg-flockie-orange/10",
  buddy_match: "border-[#06D6A0] bg-[#06D6A0]/10",
};

export default function InboxList({ notifications }: { notifications: Notif[] }) {
  const supabase = createClient();

  // Mark everything read when the inbox opens.
  useEffect(() => {
    const unread = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (unread.length === 0) return;
    supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", unread)
      .then(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (notifications.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-ink/30 py-16 text-center font-medium text-muted">
        Nothing yet. Invitations and updates will show up here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notifications.map((n) => {
        const vibeId = n.data?.vibe_id;
        const href = vibeId
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
            <p className="text-sm font-extrabold">{n.title}</p>
            {n.body && <p className="mt-0.5 text-sm font-medium text-ink/70">{n.body}</p>}
            {n.type === "vibe_invitation" && (
              <span className="mt-2 inline-block text-sm font-bold text-flockie-orange">
                View &amp; confirm →
              </span>
            )}
          </div>
        );
        return href ? (
          <Link key={n.id} href={href} className="block">
            {card}
          </Link>
        ) : (
          <div key={n.id}>{card}</div>
        );
      })}
    </div>
  );
}
