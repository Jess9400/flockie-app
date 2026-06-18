"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Msg = { id: string; sender_id: string; content: string; created_at: string };

export default function BuddyChatRoom({
  chatId,
  currentUserId,
  otherName,
  initialMessages,
  opener,
}: {
  chatId: string;
  currentUserId: string;
  otherName: string;
  initialMessages: Msg[];
  opener: string;
}) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  // Pre-fill the composer with the editable opener when the chat is empty.
  const [text, setText] = useState(initialMessages.length === 0 ? opener : "");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    supabase.rpc("mark_chat_read", { p_chat: chatId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  useEffect(() => {
    const channel = supabase
      .channel(`buddy-${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "buddy_messages", filter: `chat_id=eq.${chatId}` },
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
      .from("buddy_messages")
      .insert({ chat_id: chatId, sender_id: currentUserId, content });
    setSending(false);
    if (error) setText(content);
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto py-4">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm font-medium text-muted">
            You matched with {otherName}. Break the ice 👇
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl border-2 border-ink px-3 py-2 text-sm font-medium ${mine ? "bg-flockie-orange text-white" : "bg-cream text-ink"}`}>
                {m.content}
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
          placeholder={`Message ${otherName}…`}
          className="w-full rounded-full border-2 border-ink bg-white px-4 py-2.5 font-medium outline-none"
        />
        <button type="submit" disabled={sending}
          className="shrink-0 rounded-full border-2 border-ink bg-flockie-orange px-5 font-bold text-white disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}
