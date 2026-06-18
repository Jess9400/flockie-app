"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Msg = { id: string; sender_id: string; content: string; created_at: string };
type Member = { display_name: string | null; photos: string[] | null };

export default function ChatRoom({
  chatId,
  currentUserId,
  members,
  initialMessages,
}: {
  chatId: string;
  currentUserId: string;
  members: Record<string, Member>;
  initialMessages: Msg[];
}) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vibing_messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const m = payload.new as Msg;
          setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setSending(true);
    setText("");
    const { error } = await supabase
      .from("vibing_messages")
      .insert({ chat_id: chatId, sender_id: currentUserId, content });
    setSending(false);
    if (error) setText(content); // restore on failure
  }

  return (
    <div className="flex h-[calc(100vh-13rem)] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto py-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm font-medium text-muted">
            Say hi 👋 — this is your group chat.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          const who = members[m.sender_id];
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-flockie-blue text-xs font-bold text-white">
                {(who?.display_name || "F")[0]}
              </span>
              <div className={`max-w-[75%] ${mine ? "text-right" : ""}`}>
                {!mine && (
                  <p className="mb-0.5 text-[11px] font-bold text-muted">
                    {who?.display_name || "Flockie"}
                  </p>
                )}
                <div
                  className={`rounded-2xl border-2 border-ink px-3 py-2 text-sm font-medium ${
                    mine ? "bg-flockie-orange text-white" : "bg-cream text-ink"
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

      <form onSubmit={send} className="flex gap-2 border-t-2 border-ink bg-white py-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message the group…"
          className="w-full rounded-full border-2 border-ink bg-white px-4 py-2.5 font-medium outline-none"
        />
        <button
          type="submit"
          disabled={sending}
          className="shrink-0 rounded-full border-2 border-ink bg-flockie-orange px-5 font-bold text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
