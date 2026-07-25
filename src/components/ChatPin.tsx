"use client";

import { useEffect, useState } from "react";
import { Pin, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type PinRow = { chat_id: string; content: string; author_name: string | null };

// A single pinned message per chat, shared by every chat type (1:1, flock,
// vibe, club). Access is gated in SQL by can_access_chat.

// Sticky banner at the top of a chat showing the current pin. Live-updates via
// realtime; any member can unpin.
export function PinnedBanner({ chatId }: { chatId: string }) {
  const supabase = createClient();
  const t = useTranslations("buddies.shared");
  const [pin, setPin] = useState<PinRow | null>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from("chat_pins")
      .select("chat_id, content, author_name")
      .eq("chat_id", chatId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setPin((data as PinRow) ?? null);
      });
    const channel = supabase
      .channel(`pin-${chatId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_pins", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          if (payload.eventType === "DELETE") setPin(null);
          else setPin(payload.new as PinRow);
        }
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  if (!pin) return null;

  const isImg = /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(pin.content) || pin.content.includes("/storage/v1/object");

  async function unpin() {
    setPin(null);
    await supabase.from("chat_pins").delete().eq("chat_id", chatId);
  }

  return (
    <div className="shrink-0 border-b border-flockie-blue/20 bg-flockie-blue/5 px-3 py-2">
      <div className="flex items-center gap-2">
        <Pin size={14} className="shrink-0 rotate-45 text-flockie-blue" />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-extrabold uppercase tracking-wide text-flockie-blue/70">
            {t("pinnedLabel")}
            {pin.author_name ? ` · ${pin.author_name}` : ""}
          </span>
          <span className="block truncate text-[13px] font-semibold text-ink">
            {isImg ? "📷 —" : pin.content}
          </span>
        </span>
        <button
          type="button"
          onClick={unpin}
          aria-label={t("unpin")}
          className="shrink-0 rounded-full p-1 text-ink/40 hover:bg-white hover:text-ink"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

// Small pin control shown on a message bubble. Upserts the chat's pin.
export function PinButton({
  chatId,
  content,
  author,
  meId,
}: {
  chatId: string;
  content: string;
  author: string | null;
  meId: string;
}) {
  const supabase = createClient();
  const t = useTranslations("buddies.shared");
  const [busy, setBusy] = useState(false);

  async function pin() {
    if (busy) return;
    setBusy(true);
    await supabase
      .from("chat_pins")
      .upsert(
        { chat_id: chatId, content, author_name: author, pinned_by: meId, pinned_at: new Date().toISOString() },
        { onConflict: "chat_id" }
      );
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={pin}
      disabled={busy}
      aria-label={t("pin")}
      title={t("pin")}
      className="shrink-0 self-center rounded-full p-1 text-ink/25 opacity-40 transition-opacity hover:text-flockie-blue sm:opacity-0 sm:group-hover/msg:opacity-100"
    >
      <Pin size={13} className="rotate-45" />
    </button>
  );
}
