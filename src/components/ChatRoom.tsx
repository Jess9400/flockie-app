"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatMessageDivider, needsDivider } from "@/lib/chat";

type Msg = { id: string; sender_id: string | null; content: string; created_at: string };
type Member = { display_name: string | null; photos: string[] | null };

function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000;
}

export default function ChatRoom({
  chatId,
  currentUserId,
  members,
  initialMessages,
  startsAt,
  bookingUrl,
}: {
  chatId: string;
  currentUserId: string;
  members: Record<string, Member>;
  initialMessages: Msg[];
  startsAt?: string | null;
  bookingUrl?: string | null;
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
    supabase.rpc("mark_chat_read", { p_chat: chatId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

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
    if (error) setText(content);
  }

  // Precompute sequence/divider flags.
  let prevSender: string | null | undefined;
  let prevTime: string | null = null;
  const rows = messages.map((m) => {
    const divider = needsDivider(prevTime, m.created_at);
    const firstInSeq = divider || prevSender !== m.sender_id;
    prevSender = m.sender_id;
    prevTime = m.created_at;
    return { m, divider, firstInSeq };
  });

  const startsSoon = startsAt != null && hoursUntil(startsAt) > 0 && hoursUntil(startsAt) < 24;

  return (
    <div className="flex h-[calc(100vh-13rem)] flex-col font-nunito">
      <div className="flex-1 space-y-1 overflow-y-auto py-4">
        {/* Welcome breadcrumb */}
        <p className="px-6 py-2 text-center font-nunito text-[13px] font-medium italic text-navy/50">
          This is the start of your Vibe chat. Say hi 👋
        </p>

        {rows.map(({ m, divider, firstInSeq }) => {
          if (m.sender_id === null) {
            return (
              <p key={m.id} className="px-6 py-1.5 text-center font-nunito text-[13px] font-medium italic text-navy/50">
                {m.content}
              </p>
            );
          }
          const mine = m.sender_id === currentUserId;
          const who = members[m.sender_id];
          const avatar = who?.photos?.[0];
          const name = who?.display_name || "Flockie";

          return (
            <div key={m.id}>
              {divider && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="h-px flex-1 bg-navy/10" />
                  <span className="font-nunito text-[11px] font-medium text-navy/40">
                    {formatMessageDivider(m.created_at)}
                  </span>
                  <span className="h-px flex-1 bg-navy/10" />
                </div>
              )}
              <div className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                {!mine &&
                  (firstInSeq ? (
                    avatar ? (
                      <Image
                        src={avatar}
                        alt=""
                        width={32}
                        height={32}
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-flockie-blue text-xs font-bold text-white">
                        {name[0]?.toUpperCase()}
                      </span>
                    )
                  ) : (
                    <span className="h-8 w-8 shrink-0" />
                  ))}
                <div className={`max-w-[70%] ${mine ? "items-end" : ""}`}>
                  {!mine && firstInSeq && (
                    <p className="mb-0.5 ml-1 font-nunito text-xs font-medium text-navy/60">{name}</p>
                  )}
                  <div
                    className={`px-3.5 py-2 font-nunito text-[15px] shadow-[0_1px_2px_rgba(10,37,69,0.05)] ${
                      mine
                        ? "rounded-[18px] rounded-br-[4px] bg-flockie-blue text-white"
                        : "rounded-[18px] rounded-bl-[4px] bg-white text-navy"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Smart prompts above input */}
      {(bookingUrl || startsSoon) && (
        <div className="flex flex-wrap gap-2 pb-2">
          {bookingUrl && (
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border-2 border-navy bg-flockie-coral px-3 py-1 font-nunito text-xs font-bold text-white"
            >
              🎟️ Book your spot →
            </a>
          )}
          {startsSoon && startsAt && (
            <span className="rounded-full bg-flockie-coral/15 px-3 py-1 font-nunito text-xs font-bold text-navy">
              Vibe starts in {Math.round(hoursUntil(startsAt))}h
            </span>
          )}
        </div>
      )}

      <form onSubmit={send} className="flex items-center gap-2 pt-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message the group…"
          className="h-12 w-full rounded-full border-2 border-navy bg-cream px-5 font-nunito text-[15px] font-medium text-navy outline-none focus:border-flockie-blue"
        />
        <button
          type="submit"
          disabled={sending}
          aria-label="Send"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-flockie-coral text-white disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
