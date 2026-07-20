"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useEsc } from "@/lib/use-esc";
import { SKILL_SCALE } from "@/lib/vibe-check";

// "I'm in" on someone's posted activity. Asks (optionally) for the joiner's
// level + a short note, then calls request_join_activity — the creator gets a
// rich notification (age · gender · level · match % · note) so they accept
// with the right expectations.
export default function JoinActivityButton({
  activityId,
  title,
  creatorName,
  compact = false,
}: {
  activityId: string;
  title: string;
  creatorName: string;
  compact?: boolean;
}) {
  const supabase = createClient();
  const t = useTranslations("match.board");
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  async function send() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("request_join_activity", {
      p_activity: activityId,
      p_level: level,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      setError(
        error.message.includes("blocked_by_preferences")
          ? t("errBlocked")
          : error.message
      );
      return;
    }
    setSent(true);
  }

  function close() {
    setOpen(false);
    setError(null);
  }

  useEsc(() => !busy && close(), open);

  // Non-compact = full-width card CTA (matches the home VibeCard's homeCta).
  const btnCls = compact
    ? "rounded-full bg-flockie-coral px-4 py-1.5 text-xs font-bold text-white transition-transform active:scale-95"
    : "flex w-full items-center justify-center rounded-xl bg-flockie-coral py-2 text-xs font-extrabold text-white transition-transform active:scale-[0.98]";

  if (sent && !open) {
    return (
      <span
        className={
          compact
            ? "rounded-full bg-onboarding-green px-4 py-1.5 text-xs font-bold text-white"
            : "flex w-full items-center justify-center rounded-xl bg-onboarding-green py-2 text-xs font-extrabold text-white"
        }
      >
        {t("requested")}
      </span>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btnCls}>
        {t("imIn")}
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => !busy && close()}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t("joinAria", { title })}
              className="w-full max-w-sm rounded-3xl border-2 border-ink/15 bg-white p-6 shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
              onClick={(e) => e.stopPropagation()}
            >
              {sent ? (
                <div className="text-center">
                  <p className="text-4xl">✋</p>
                  <h2 className="mt-2 text-xl font-extrabold text-ink">
                    {t("sentTitle", { name: creatorName })}
                  </h2>
                  <p className="mt-1 text-sm font-medium text-muted">
                    {t("sentBody", { name: creatorName })}
                  </p>
                  <button
                    type="button"
                    onClick={close}
                    className="mt-4 w-full rounded-full border border-ink/15 bg-flockie-blue py-2.5 text-sm font-bold text-white"
                  >
                    {t("done")}
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-center text-xl font-extrabold text-ink">
                    {t("joinTitle", { title })}
                  </h2>
                  <p className="mt-1 text-center text-sm font-medium text-muted">
                    {t("joinSubtitle", { name: creatorName })}
                  </p>

                  <p className="mt-4 text-xs font-bold uppercase tracking-wide text-ink/50">
                    {t("levelLabel")}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {SKILL_SCALE.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={busy}
                        onClick={() => setLevel(level === s ? null : s)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                          level === s
                            ? "border-flockie-coral bg-flockie-coral text-white"
                            : "border-ink/15 bg-cream text-ink hover:border-flockie-coral/50"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t("notePlaceholder")}
                    maxLength={200}
                    className="mt-3 h-11 w-full rounded-xl border border-ink/25 px-4 text-sm font-medium outline-none focus:border-flockie-blue"
                  />

                  <button
                    type="button"
                    disabled={busy}
                    onClick={send}
                    className="mt-4 w-full rounded-full border border-ink/15 bg-flockie-coral py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {busy ? t("sending") : t("sendRequest")}
                  </button>
                  {error && (
                    <p className="mt-2 text-center text-sm font-bold text-red-700">{error}</p>
                  )}
                  <button
                    type="button"
                    onClick={close}
                    disabled={busy}
                    className="mt-3 block w-full text-center text-sm font-bold text-muted underline disabled:opacity-50"
                  >
                    {t("cancel")}
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
