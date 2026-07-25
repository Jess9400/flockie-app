"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Send, ImagePlus } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { formatMessageDivider, needsDivider } from "@/lib/chat";
import { isImageUrl, firstUrl } from "@/lib/chat-content";
import LinkPreview from "@/components/LinkPreview";

export type ClubMsg = {
  id: string;
  club_id: string;
  sender_id: string | null;
  content: string;
  created_at: string;
};

// The club's persistent room — realtime chat over club_messages, styled to
// match the buddy/vibe rooms: date dividers, sender grouping, image messages,
// link previews, and a photo attach button.
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
  const locale = useLocale();
  const instanceId = useId();
  const [messages, setMessages] = useState<ClubMsg[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const imgInput = useRef<HTMLInputElement>(null);

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

  async function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${currentUserId}/chat-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (!error) {
        const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
        await supabase.from("club_messages").insert({ club_id: clubId, sender_id: currentUserId, content: url });
      }
    } finally {
      setUploading(false);
      if (imgInput.current) imgInput.current.value = "";
    }
  }

  // sequence/divider flags (club rooms are always group chats)
  let prevTime: string | null = null;
  let prevSender: string | null = null;
  const rows = messages.map((m) => {
    const divider = needsDivider(prevTime, m.created_at);
    const firstInSeq = divider || prevSender !== m.sender_id;
    prevTime = m.created_at;
    prevSender = m.sender_id;
    return { m, divider, firstInSeq };
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col font-nunito">
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto py-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm font-medium text-muted">{t("empty")}</p>
        )}
        {rows.map(({ m, divider, firstInSeq }) => {
          const mine = m.sender_id === currentUserId;
          const mem = m.sender_id ? members[m.sender_id] : null;
          return (
            <div key={m.id}>
              {divider && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="h-px flex-1 bg-navy/10" />
                  <span className="font-nunito text-[11px] font-medium text-navy/40">
                    {formatMessageDivider(m.created_at, locale)}
                  </span>
                  <span className="h-px flex-1 bg-navy/10" />
                </div>
              )}
              <div className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                {!mine && (
                  <div className="h-7 w-7 shrink-0">
                    {firstInSeq &&
                      (mem?.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mem.photo} alt="" className="h-7 w-7 rounded-full border border-ink/15 object-cover" />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-ink/15 bg-flockie-blue text-[10px] font-bold text-white">
                          {(mem?.name ?? "F")[0]?.toUpperCase()}
                        </span>
                      ))}
                  </div>
                )}
                <div className={`flex max-w-[78%] flex-col lg:max-w-[620px] ${mine ? "items-end" : "items-start"}`}>
                  {!mine && firstInSeq && mem && (
                    <p className="mb-0.5 ml-1 font-nunito text-xs font-medium text-navy/60">{mem.name}</p>
                  )}
                  {isImageUrl(m.content) ? (
                    <a href={m.content} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.content} alt="" className="max-w-[260px] rounded-[18px] border border-navy/10" />
                    </a>
                  ) : (
                    <>
                      <div
                        className={`px-3.5 py-2 font-nunito text-[15px] shadow-[0_1px_2px_rgba(10,37,69,0.05)] ${
                          mine
                            ? "rounded-[18px] rounded-br-[4px] bg-flockie-blue text-white"
                            : "rounded-[18px] rounded-bl-[4px] bg-white text-navy"
                        }`}
                      >
                        {m.content}
                      </div>
                      {firstUrl(m.content) && <LinkPreview url={firstUrl(m.content)!} />}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="flex shrink-0 items-center gap-2 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <input ref={imgInput} type="file" accept="image/*" hidden onChange={onImage} />
        <button
          type="button"
          onClick={() => imgInput.current?.click()}
          disabled={uploading}
          aria-label={t("send")}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-navy/15 text-navy disabled:opacity-50"
        >
          <ImagePlus size={18} />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={uploading ? "…" : t("placeholder")}
          className="h-12 w-full rounded-full border border-navy/25 bg-cream px-5 font-nunito text-[15px] font-medium text-navy outline-none focus:border-flockie-blue"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-flockie-coral text-white disabled:opacity-50"
          aria-label={t("send")}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
