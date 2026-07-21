"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export default function VibeTakeEditor({
  vibeId,
  vibeTitle,
  initialBody,
}: {
  vibeId: string;
  vibeTitle: string;
  initialBody?: string | null;
}) {
  const router = useRouter();
  const t = useTranslations("profile.takes");
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(initialBody ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setBody(initialBody ?? "");
    setError(null);
    setOpen(false);
  }

  async function save() {
    if (!body.trim() || saving) return;
    setSaving(true);
    setError(null);
    const { error: saveError } = await supabase.rpc("save_vibe_take", {
      p_vibe: vibeId,
      p_body: body,
    });
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function remove() {
    if (!initialBody || saving) return;
    setSaving(true);
    setError(null);
    const { error: deleteError } = await supabase.from("vibe_takes").delete().eq("vibe_id", vibeId);
    setSaving(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-full border border-ink/15 bg-cream px-3 py-2 text-xs font-extrabold text-navy transition hover:border-flockie-coral/50"
      >
        {initialBody ? t("edit") : t("add")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-navy/45 p-3 sm:items-center sm:justify-center">
          <div role="dialog" aria-modal="true" aria-label={t("dialogTitle")} className="w-full max-w-lg rounded-[28px] bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-fredoka text-2xl font-bold text-navy">{t("dialogTitle")}</p>
                <p className="mt-1 text-sm font-semibold text-muted">{vibeTitle}</p>
              </div>
              <button type="button" onClick={close} aria-label={t("close")} className="rounded-full p-2 text-navy/60 hover:bg-cream hover:text-navy">
                <X size={19} />
              </button>
            </div>

            <p className="mt-5 text-sm font-semibold leading-relaxed text-navy/75">{t("privateNote")}</p>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={280}
              autoFocus
              rows={5}
              placeholder={t("placeholder")}
              className="mt-3 w-full resize-none rounded-2xl border-2 border-ink/15 bg-cream px-4 py-3 text-base font-semibold text-navy outline-none focus:border-flockie-coral"
            />
            <p className="mt-1 text-right text-xs font-bold text-muted">{t("characters", { count: body.length })}</p>
            {error && <p className="mt-2 text-sm font-bold text-red-700">{error}</p>}

            <div className="mt-4 flex flex-wrap justify-between gap-2">
              {initialBody ? (
                <button type="button" onClick={remove} disabled={saving} className="rounded-full px-4 py-2.5 text-sm font-extrabold text-red-700 disabled:opacity-50">
                  {t("delete")}
                </button>
              ) : <span />}
              <div className="flex gap-2">
                <button type="button" onClick={close} disabled={saving} className="rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-extrabold text-navy disabled:opacity-50">
                  {t("cancel")}
                </button>
                <button type="button" onClick={save} disabled={!body.trim() || saving} className="rounded-full bg-flockie-coral px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">
                  {saving ? t("saving") : t("save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
