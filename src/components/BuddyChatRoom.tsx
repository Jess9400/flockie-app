"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, Sparkles, X, ImagePlus } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { formatMessageDivider, needsDivider } from "@/lib/chat";
import { isImageUrl, firstUrl } from "@/lib/chat-content";
import LinkPreview from "@/components/LinkPreview";
import { PinnedBanner, PinButton } from "@/components/ChatPin";
import MessageText from "@/components/MessageText";
import MessageActions from "@/components/MessageActions";

type Msg = { id: string; sender_id: string; content: string; created_at: string; edited_at?: string | null };
// Client-only flags for optimistic local echo (never persisted).
type LocalMsg = Msg & { pending?: boolean; failed?: boolean };

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
  members,
  isGroup,
}: {
  chatId: string;
  currentUserId: string;
  otherId: string;
  otherName: string;
  initialMessages: Msg[];
  icebreaker: string;
  tripStartIso: string | null;
  tripEndIso: string | null;
  members?: Record<string, { name: string; photo: string | null }>;
  isGroup?: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("buddies");
  const locale = useLocale();
  const [messages, setMessages] = useState<LocalMsg[]>(initialMessages);
  const [text, setText] = useState("");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState(false);
  const [uploading, setUploading] = useState(false);
  const imgInput = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

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
        await supabase.from("buddy_messages").insert({ chat_id: chatId, sender_id: currentUserId, content: url });
      }
    } finally {
      setUploading(false);
      if (imgInput.current) imgInput.current.value = "";
    }
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // Mark read, then bust the router cache so the chats-list badge updates.
    supabase.rpc("mark_chat_read", { p_chat: chatId }).then(() => router.refresh());
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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "buddy_messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const m = payload.new as Msg;
          setMessages((cur) => cur.map((x) => (x.id === m.id ? { ...x, content: m.content, edited_at: m.edited_at } : x)));
        }
      )
      .on(
        // DELETE payloads only carry the primary key, so no chat filter — we drop
        // the row locally only if we already have it.
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "buddy_messages" },
        (payload) => {
          const oldId = (payload.old as { id?: string }).id;
          if (oldId) setMessages((cur) => cur.filter((x) => x.id !== oldId));
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

  // Insert the row and reconcile the optimistic copy. On success the temp row
  // is swapped for the real one (deduped against a realtime INSERT that may have
  // already landed); on failure it's marked failed so the user can retry.
  async function deliver(tempId: string, content: string) {
    const { data, error } = await supabase
      .from("buddy_messages")
      .insert({ chat_id: chatId, sender_id: currentUserId, content })
      .select("id, sender_id, content, created_at")
      .single();
    if (error || !data) {
      setMessages((cur) => cur.map((x) => (x.id === tempId ? { ...x, pending: false, failed: true } : x)));
      return;
    }
    const real = data as Msg;
    setMessages((cur) => {
      const without = cur.filter((x) => x.id !== tempId);
      return without.some((x) => x.id === real.id) ? without : [...without, real];
    });
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setText("");
    const tempId = `temp-${crypto.randomUUID()}`;
    setMessages((cur) => [
      ...cur,
      { id: tempId, sender_id: currentUserId, content, created_at: new Date().toISOString(), pending: true },
    ]);
    await deliver(tempId, content);
  }

  function retry(m: LocalMsg) {
    setMessages((cur) => cur.map((x) => (x.id === m.id ? { ...x, pending: true, failed: false } : x)));
    deliver(m.id, m.content);
  }

  // Progressive prompts (client-derived, dismissible).
  const prompts: { key: string; text: string; cta?: { label: string; href: string } }[] = [];
  if (messages.length >= 5) {
    prompts.push({ key: "rapport", text: t("room.promptRapport") });
  }
  if (tripStartIso) {
    const h = hoursUntil(tripStartIso);
    if (h > 0 && h < 24 * 7) {
      prompts.push({
        key: "pretrip",
        text: t("room.promptPretrip", { name: otherName }),
      });
    }
  }
  if (tripEndIso) {
    const daysAfter = -hoursUntil(tripEndIso) / 24;
    // Only ask for a review once there's been actual contact — never on a
    // brand-new match whose activity happens to be past-dated.
    if (daysAfter >= 2 && messages.length > 0) {
      prompts.push({
        key: "review",
        text: t("room.promptReview", { name: otherName }),
        cta: { label: t("room.leaveReview"), href: `/review/${otherId}` },
      });
    }
  }

  // Hide the system plan-status lines ("📅 proposed a plan", "✅ accepted the
  // plan", "↩️ passed on the plan") — the plan card already conveys all of this,
  // so echoing them as chat messages just reads as clutter.
  const PLAN_SYSTEM = ["📅 proposed a plan", "✅ accepted the plan", "↩️ passed on the plan"];
  const visibleMessages = messages.filter(
    (m) => !(m.sender_id === null && PLAN_SYSTEM.includes(m.content.trim()))
  );

  // sequence/divider flags
  let prevTime: string | null = null;
  let prevSender: string | null = null;
  function applyEdit(id: string, content: string) {
    setMessages((cur) => cur.map((x) => (x.id === id ? { ...x, content, edited_at: new Date().toISOString() } : x)));
  }
  function applyDelete(id: string) {
    setMessages((cur) => cur.filter((x) => x.id !== id));
  }

  const rows = visibleMessages.map((m) => {
    const divider = needsDivider(prevTime, m.created_at);
    const firstInSeq = divider || prevSender !== m.sender_id;
    prevTime = m.created_at;
    prevSender = m.sender_id;
    return { m, divider, firstInSeq };
  });

  return (
    <div className="relative flex min-h-0 flex-1 flex-col font-nunito">
      {toast && (
        <div className="absolute left-1/2 top-2 z-30 -translate-x-1/2 rounded-full border border-navy/15 bg-flockie-coral px-4 py-1.5 font-fredoka text-sm font-semibold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
          {t("room.matchedToast")}
        </div>
      )}

      <PinnedBanner chatId={chatId} />

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto py-4">
        {/* Algo icebreaker — suppressed when a plan card is carrying the intro
            so we never show two "here's your match" blocks at once. */}
        {icebreaker && (
        <div className="mx-auto my-3 max-w-[92%] rounded-2xl border-2 border-flockie-blue bg-cream p-4">
          <p className="flex items-center gap-1.5 font-fredoka text-sm font-semibold text-flockie-blue">
            <Sparkles size={15} /> {isGroup ? t("room.tripPlan") : t("room.algoSays")}
          </p>
          <p className="mt-1.5 whitespace-pre-line font-nunito text-sm font-medium text-navy">
            {icebreaker}
          </p>
        </div>
        )}

        {rows.map(({ m, divider, firstInSeq }) => {
          // Workspace/system events (null sender) render as a centered line.
          if (m.sender_id === null) {
            return (
              <div key={m.id} className="px-6 py-1.5 text-center">
                <span className="inline-block rounded-full bg-cream px-3 py-1 font-nunito text-[12px] font-semibold text-navy/55">
                  {m.content}
                </span>
              </div>
            );
          }
          const mine = m.sender_id === currentUserId;
          const mem = members?.[m.sender_id];
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
              <div className={`group/msg flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                {mine && !isImageUrl(m.content) && !m.pending && (
                  <MessageActions table="buddy_messages" id={m.id} content={m.content} onChanged={applyEdit} onRemoved={applyDelete} />
                )}
                {mine && !isImageUrl(m.content) && !m.pending && (
                  <PinButton chatId={chatId} content={m.content} author={null} meId={currentUserId} />
                )}
                {!mine && isGroup && (
                  <div className="h-7 w-7 shrink-0">
                    {firstInSeq &&
                      (mem?.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mem.photo}
                          alt=""
                          className="h-7 w-7 rounded-full border border-ink/15 object-cover"
                        />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-ink/15 bg-flockie-blue text-[10px] font-bold text-white">
                          {(mem?.name ?? "F")[0]}
                        </span>
                      ))}
                  </div>
                )}
                <div className={`flex max-w-[78%] flex-col lg:max-w-[620px] ${mine ? "items-end" : "items-start"}`}>
                  {!mine && isGroup && firstInSeq && (
                    <p className="mb-0.5 ml-1 font-nunito text-xs font-medium text-navy/60">
                      {mem?.name ?? "Flockie"}
                    </p>
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
                        } ${m.pending ? "opacity-60" : ""}`}
                      >
                        <MessageText content={m.content} mine={mine} />
                        {m.edited_at && (
                          <span className={`ml-1.5 text-[10px] font-semibold ${mine ? "text-white/60" : "text-navy/40"}`}>
                            ({t("shared.edited")})
                          </span>
                        )}
                      </div>
                      {m.failed && (
                        <button
                          type="button"
                          onClick={() => retry(m)}
                          className="mr-1 mt-0.5 font-nunito text-[11px] font-bold text-flockie-coral"
                        >
                          {t("shared.failedRetry")}
                        </button>
                      )}
                      {firstUrl(m.content) && <LinkPreview url={firstUrl(m.content)!} />}
                    </>
                  )}
                </div>
                {!mine && !isImageUrl(m.content) && (
                  <PinButton chatId={chatId} content={m.content} author={mem?.name ?? otherName} meId={currentUserId} />
                )}
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
                aria-label={t("room.dismiss")}
                className="text-navy/30 hover:text-navy/60"
              >
                <X size={13} />
              </button>
            </div>
          ))}

        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="flex shrink-0 items-center gap-2 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <input ref={imgInput} type="file" accept="image/*" hidden onChange={onImage} />
        <button
          type="button"
          onClick={() => imgInput.current?.click()}
          disabled={uploading}
          aria-label={t("shared.sendPhoto")}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-navy/15 text-navy disabled:opacity-50"
        >
          <ImagePlus size={18} />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={uploading ? t("shared.sendingPhoto") : t("room.messagePerson", { name: otherName })}
          className="h-12 w-full rounded-full border border-navy/25 bg-cream px-5 font-nunito text-[15px] font-medium text-navy outline-none focus:border-flockie-blue"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label={t("shared.send")}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-flockie-coral text-white disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
