"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Send, Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatMessageDivider, needsDivider } from "@/lib/chat";

type Msg = { id: string; sender_id: string; content: string; created_at: string };

function hoursUntil(iso: string) {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000;
}

export default function BuddyChatRoom({
  chatId,
  currentUserId,
  otherId,
  otherName,
  initialMessages,
  icebreaker,
  tripStartIso,
  tripEndIso,
}: {
  chatId: string;
  currentUserId: string;
  otherId: string;
  otherName: string;
  initialMessages: Msg[];
  icebreaker: string;
  tripStartIso: string | null;
  tripEndIso: string | null;
}) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    supabase.rpc("mark_chat_read", { p_chat: chatId });
    try {
      const raw = localStorage.getItem(`buddy-dismissed-${chatId}`);
      if (raw) setDismissed(new Set(JSON.parse(raw)));
      if (!localStorage.getItem(`buddy-welcome-${chatId}`)) {
        setToast(true);
        localStorage.setItem(`buddy-welcome-${chatId}`, "1");
        setTimeout(() => setToast(false), 3000);
      }
    } catch {}
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

  function dismiss(key: string) {
    setDismissed((cur) => {
      const next = new Set(cur).add(key);
      try {
        localStorage.setItem(`buddy-dismissed-${chatId}`, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }

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

  // Progressive prompts (client-derived, dismissible).
  const prompts: { key: string; text: string; cta?: { label: string; href: string } }[] = [];
  if (messages.length >= 5) {
    prompts.push({ key: "rapport", text: "Looks like you two are getting along. Ready to share tentative dates?" });
  }
  if (tripStartIso) {
    const h = hoursUntil(tripStartIso);
    if (h > 0 && h < 24 * 7) {
      prompts.push({
        key: "pretrip",
        text: `Trip with ${otherName} starts soon. Want to share your booking confirmations in the chat?`,
      });
    }
  }
  if (tripEndIso) {
    const daysAfter = -hoursUntil(tripEndIso) / 24;
    if (daysAfter >= 2) {
      prompts.push({
        key: "review",
        text: `How was the trip with ${otherName}?`,
        cta: { label: "Leave a review →", href: `/people/${otherId}` },
      });
    }
  }

  // sequence/divider flags
  let prevTime: string | null = null;
  const rows = messages.map((m) => {
    const divider = needsDivider(prevTime, m.created_at);
    prevTime = m.created_at;
    return { m, divider };
  });

  return (
    <div className="relative flex h-[calc(100vh-13rem)] flex-col font-nunito">
      {toast && (
        <div className="absolute left-1/2 top-2 z-30 -translate-x-1/2 rounded-full border-2 border-navy bg-flockie-coral px-4 py-1.5 font-fredoka text-sm font-semibold text-white shadow-[0_3px_0_rgba(10,37,69,1)]">
          🎉 You matched! Say hi 👋
        </div>
      )}

      <div className="flex-1 space-y-1 overflow-y-auto py-4">
        {/* Algo icebreaker */}
        <div className="mx-auto my-3 max-w-[92%] rounded-2xl border-2 border-flockie-blue bg-cream p-4">
          <p className="flex items-center gap-1.5 font-fredoka text-sm font-semibold text-flockie-blue">
            <Sparkles size={15} /> The algo says:
          </p>
          <p className="mt-1.5 whitespace-pre-line font-nunito text-sm font-medium text-navy">
            {icebreaker}
          </p>
        </div>

        {rows.map(({ m, divider }) => {
          const mine = m.sender_id === currentUserId;
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
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[70%] px-3.5 py-2 font-nunito text-[15px] shadow-[0_1px_2px_rgba(10,37,69,0.05)] ${
                    mine
                      ? "rounded-[18px] rounded-br-[4px] bg-flockie-blue text-white"
                      : "rounded-[18px] rounded-bl-[4px] bg-white text-navy"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            </div>
          );
        })}

        {/* Progressive nudges */}
        {prompts
          .filter((p) => !dismissed.has(p.key))
          .map((p) => (
            <div key={p.key} className="flex items-center justify-center gap-2 px-6 py-2 text-center">
              <p className="font-nunito text-[13px] font-medium italic text-navy/50">
                {p.text}{" "}
                {p.cta && (
                  <Link href={p.cta.href} className="font-semibold text-flockie-blue not-italic">
                    {p.cta.label}
                  </Link>
                )}
              </p>
              <button
                type="button"
                onClick={() => dismiss(p.key)}
                aria-label="Dismiss"
                className="text-navy/30 hover:text-navy/60"
              >
                <X size={13} />
              </button>
            </div>
          ))}

        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="flex items-center gap-2 pt-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message ${otherName}…`}
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
