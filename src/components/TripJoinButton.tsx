"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useEsc } from "@/lib/use-esc";

// "Ask to join" on a trip/flock board card: optional note, then the host gets
// a rich request (name · city · past trips · match % · note) to approve from
// My Plans → Trips. Accept rides the existing respond_join_request flow.
export default function TripJoinButton({
  tripId,
  destination,
  creatorName,
  initialStatus,
}: {
  tripId: string;
  destination: string;
  creatorName: string;
  initialStatus: string | null;
}) {
  const supabase = createClient();
  const t = useTranslations("trips.board");
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);
  useEsc(() => !busy && setOpen(false), open);

  async function send() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("request_join_trip_v2", {
      p_trip: tripId,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      setError(
        error.message.includes("blocked_by_preferences") ? t("errBlocked") : error.message
      );
      return;
    }
    setSent(true);
    setStatus("pending");
  }

  if (status === "accepted") {
    return (
      <span className="shrink-0 rounded-full bg-onboarding-green px-4 py-1.5 text-xs font-bold text-white">
        {t("going")}
      </span>
    );
  }
  if (status === "pending" && !open) {
    return (
      <span className="shrink-0 rounded-full bg-cream px-4 py-1.5 text-xs font-bold text-ink/60">
        {t("requested")}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-full bg-flockie-coral px-4 py-1.5 text-xs font-bold text-white transition-transform active:scale-95"
      >
        {t("askToJoin")}
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => !busy && setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t("dialogAria", { destination })}
              className="w-full max-w-sm rounded-3xl border-2 border-ink/15 bg-white p-6 shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
              onClick={(e) => e.stopPropagation()}
            >
              {sent ? (
                <div className="text-center">
                  <p className="text-4xl">🧳</p>
                  <h2 className="mt-2 text-xl font-extrabold text-ink">{t("sentTitle")}</h2>
                  <p className="mt-1 text-sm font-medium text-muted">
                    {t("sentBody", { name: creatorName })}
                  </p>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="mt-4 w-full rounded-full border border-ink/15 bg-flockie-blue py-2.5 text-sm font-bold text-white"
                  >
                    {t("done")}
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-center text-xl font-extrabold text-ink">
                    {t("dialogTitle", { destination })}
                  </h2>
                  <p className="mt-1 text-center text-sm font-medium text-muted">
                    {t("dialogSubtitle", { name: creatorName })}
                  </p>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t("notePlaceholder")}
                    maxLength={280}
                    rows={3}
                    className="mt-4 w-full resize-none rounded-xl border border-ink/25 px-4 py-2.5 text-sm font-medium outline-none focus:border-flockie-blue"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={send}
                    className="mt-3 w-full rounded-full border border-ink/15 bg-flockie-coral py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {busy ? t("sending") : t("sendRequest")}
                  </button>
                  {error && (
                    <p className="mt-2 text-center text-sm font-bold text-red-700">{error}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
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
