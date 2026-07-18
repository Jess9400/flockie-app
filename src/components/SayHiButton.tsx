"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useEsc } from "@/lib/use-esc";

const ACTIVITY_KEYS = ["coffee", "lunch", "walk", "drinks"] as const;
const ACTIVITY_EMOJI: Record<(typeof ACTIVITY_KEYS)[number], string> = {
  coffee: "☕",
  lunch: "🍽️",
  walk: "🚶",
  drinks: "🍻",
};

// "Say hi" by proposing a concrete activity. Reuses buddy_swipe: this records a
// like with an activity title, which notifies the person ("X wants to grab
// coffee"). When they match back from your profile, a buddy chat opens.
export default function SayHiButton({
  personId,
  personName,
}: {
  personId: string;
  personName: string;
}) {
  const supabase = createClient();
  const t = useTranslations("match.sayHi");
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setMounted(true), []);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(activity: string) {
    const title = activity.trim();
    if (!title || busy) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("buddy_swipe", {
      p_target: personId,
      p_liked: true,
      p_activity_title: title,
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
    setSent(title);
  }

  function close() {
    setOpen(false);
    setSent(null);
    setCustom("");
    setError(null);
  }

  useEsc(() => !busy && close(), open);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-full border border-ink/15 bg-flockie-coral py-1.5 text-xs font-bold text-white transition-transform active:scale-95"
      >
        {t("button")}
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
            aria-label={t("inviteAria", { name: personName })}
            className="w-full max-w-sm rounded-3xl border-2 border-ink/15 bg-white p-6 text-center shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
            onClick={(e) => e.stopPropagation()}
          >
            {sent ? (
              <>
                <p className="text-4xl">📨</p>
                <h2 className="mt-2 text-xl font-extrabold text-ink">{t("sentTitle", { name: personName })}</h2>
                <p className="mt-1 text-sm font-medium text-muted">
                  {t.rich("sentBody", {
                    activity: sent,
                    b: (chunks) => <span className="font-bold">{chunks}</span>,
                  })}
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-4 w-full rounded-full border border-ink/15 bg-flockie-blue py-2.5 text-sm font-bold text-white"
                >
                  {t("done")}
                </button>
              </>
            ) : (
              <>
                <h2 className="text-xl font-extrabold text-ink">{t("inviteToTitle", { name: personName })}</h2>
                <p className="mt-1 text-sm font-medium text-muted">{t("pickSomething")}</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {ACTIVITY_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      disabled={busy}
                      onClick={() => send(t(key))}
                      className="rounded-2xl border border-ink/15 bg-cream px-3 py-3 text-sm font-bold text-ink transition-colors hover:bg-flockie-coral hover:text-white disabled:opacity-50"
                    >
                      <span className="mr-1">{ACTIVITY_EMOJI[key]}</span> {t(key)}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder={t("somethingElse")}
                    maxLength={60}
                    className="h-11 w-full rounded-full border border-ink/25 px-4 text-sm font-medium outline-none"
                  />
                  <button
                    type="button"
                    disabled={busy || !custom.trim()}
                    onClick={() => send(custom)}
                    className="shrink-0 rounded-full border border-ink/15 bg-flockie-coral px-5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {t("send")}
                  </button>
                </div>
                {error && <p className="mt-2 text-sm font-bold text-red-700">{error}</p>}
                <button
                  type="button"
                  onClick={close}
                  disabled={busy}
                  className="mt-3 text-sm font-bold text-muted underline disabled:opacity-50"
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
