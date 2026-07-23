"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export type ClubMsg = {
  id: string;
  club_id: string;
  sender_id: string | null;
  content: string;
  created_at: string;
};

// The club's persistent room — simple realtime chat over club_messages.
export default function ClubChatRoom({
  clubId,
  currentUserId,
  initialMessages,
  members,
}: {
  clubId: string;
  currentUserId: string;
  initialMessages: ClubMsg[];
  members: Record<string, { name: string; photo: string | null }>;
}) {
  const supabase = createClient();
  const t = useTranslations("clubs.chat");
  const instanceId = useId();
  const [messages, setMessages] = useState<ClubMsg[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // Keep the unified Chats badge honest: mark this room read on mount and as
  // messages arrive while it's open (chat_reads spans all chat tables).
  useEffect(() => {
    supabase.rpc("mark_chat_read", { p_chat: clubId }).then(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, messages.length]);

  useEffect(() => {
    try {
      const channel = supabase
        .channel(`club-chat-${clubId}-${instanceId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "club_messages", filter: `club_id=eq.${clubId}` },
          (payload) => {
            const m = payload.new as ClubMsg;
            setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
          }
        )
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, instanceId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const { data, error } = await supabase
      .from("club_messages")
      .insert({ club_id: clubId, sender_id: currentUserId, content: body })
      .select("id, club_id, sender_id, content, created_at")
      .single();
    setSending(false);
    if (!error && data) {
      setText("");
      setMessages((cur) => (cur.some((x) => x.id === data.id) ? cur : [...cur, data as ClubMsg]));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto py-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm font-medium text-muted">{t("empty")}</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          const mem = m.sender_id ? members[m.sender_id] : null;
          return (
            <div key={m.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
              {!mine && (
                <div className="h-7 w-7 shrink-0">
                  {mem?.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mem.photo} alt="" className="h-7 w-7 rounded-full border border-ink/15 object-cover" />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-ink/15 bg-flockie-blue text-[10px] font-bold text-white">
                      {(mem?.name ?? "?")[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
              )}
              <div className={`flex max-w-[78%] flex-col lg:max-w-[620px] ${mine ? "items-end" : "items-start"}`}>
                {!mine && mem && (
                  <p className="mb-0.5 ml-1 text-xs font-medium text-navy/60">{mem.name}</p>
                )}
                <div
                  className={`rounded-[18px] px-3.5 py-2 text-[15px] shadow-[0_1px_2px_rgba(10,37,69,0.05)] ${
                    mine ? "rounded-br-md bg-flockie-blue text-white" : "rounded-bl-md border border-ink/10 bg-white text-ink"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="flex shrink-0 items-center gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("placeholder")}
          className="h-12 w-full rounded-full border border-navy/25 bg-cream px-5 text-[15px] font-medium text-navy outline-none focus:border-flockie-blue"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-flockie-coral text-white disabled:opacity-50"
          aria-label={t("send")}
        >
          ➤
        </button>
      </form>
    </div>
  );
}
