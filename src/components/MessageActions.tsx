"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useConfirm } from "@/components/ui/feedback";

type MsgTable = "buddy_messages" | "vibing_messages" | "club_messages";

// Edit / delete for a message you sent. Shared by every chat room; the room
// passes its table + local-state callbacks so the change shows immediately
// (realtime propagates it to everyone else).
export default function MessageActions({
  table,
  id,
  content,
  onChanged,
  onRemoved,
}: {
  table: MsgTable;
  id: string;
  content: string;
  onChanged: (id: string, content: string) => void;
  onRemoved: (id: string) => void;
}) {
  const supabase = createClient();
  const t = useTranslations("buddies.shared");
  const confirm = useConfirm();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [text, setText] = useState(content);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  async function saveEdit() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    await supabase.from(table).update({ content: body, edited_at: new Date().toISOString() }).eq("id", id);
    setBusy(false);
    onChanged(id, body);
    setEditing(false);
  }

  async function del() {
    setMenu(false);
    const res = await confirm({ title: t("deleteConfirm"), confirmLabel: t("delete"), destructive: true });
    if (!res) return;
    onRemoved(id); // optimistic
    await supabase.from(table).delete().eq("id", id);
  }

  return (
    <div ref={wrapRef} className="relative shrink-0 self-center">
      <button
        type="button"
        onClick={() => setMenu((v) => !v)}
        aria-label={t("menu")}
        className="rounded-full p-1 text-ink/25 opacity-40 transition-opacity hover:text-ink sm:opacity-0 sm:group-hover/msg:opacity-100"
      >
        <MoreHorizontal size={15} />
      </button>

      {menu && (
        <div className="absolute right-0 top-6 z-20 w-32 overflow-hidden rounded-xl border border-ink/12 bg-white py-1 shadow-[0_4px_16px_rgba(10,37,69,0.15)]">
          <button
            type="button"
            onClick={() => {
              setText(content);
              setEditing(true);
              setMenu(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-ink hover:bg-cream"
          >
            <Pencil size={14} /> {t("edit")}
          </button>
          <button
            type="button"
            onClick={del}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-flockie-coral hover:bg-cream"
          >
            <Trash2 size={14} /> {t("delete")}
          </button>
        </div>
      )}

      {editing &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(false)}>
            <div className="w-full max-w-md rounded-3xl bg-cream p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="font-fredoka text-lg font-black text-ink">{t("editTitle")}</h2>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                autoFocus
                className="mt-3 w-full resize-none rounded-2xl border-2 border-ink/15 bg-white px-3.5 py-3 text-[15px] font-medium text-navy outline-none focus:border-flockie-blue"
              />
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setEditing(false)} className="flex-1 rounded-2xl border border-ink/15 bg-white px-4 py-2.5 text-sm font-extrabold text-navy">
                  {t("cancel")}
                </button>
                <button type="button" onClick={saveEdit} disabled={busy || !text.trim()} className="flex-[1.4] rounded-2xl bg-flockie-coral px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">
                  {t("save")}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
