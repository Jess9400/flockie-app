"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ACTIVITIES = [
  { emoji: "☕", label: "Coffee" },
  { emoji: "🍽️", label: "Lunch" },
  { emoji: "🚶", label: "A walk" },
  { emoji: "🍻", label: "Drinks" },
];

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
  const [open, setOpen] = useState(false);
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
      setError(error.message);
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-full border-2 border-ink bg-flockie-coral py-1.5 text-xs font-bold text-white"
      >
        Say hi
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !busy && close()}
        >
          <div
            className="w-full max-w-sm rounded-3xl border-[3px] border-ink bg-white p-6 text-center shadow-[0_6px_0_0_rgba(10,37,69,1)]"
            onClick={(e) => e.stopPropagation()}
          >
            {sent ? (
              <>
                <p className="text-4xl">📨</p>
                <h2 className="mt-2 text-xl font-extrabold text-ink">Invite sent to {personName}!</h2>
                <p className="mt-1 text-sm font-medium text-muted">
                  We let them know you&rsquo;d like to do <span className="font-bold">{sent}</span>.
                  When they say yes back, your chat opens automatically.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-4 w-full rounded-full border-2 border-ink bg-flockie-blue py-2.5 text-sm font-bold text-white"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <h2 className="text-xl font-extrabold text-ink">Invite {personName} to…</h2>
                <p className="mt-1 text-sm font-medium text-muted">Pick something to do together.</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {ACTIVITIES.map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      disabled={busy}
                      onClick={() => send(a.label)}
                      className="rounded-2xl border-2 border-ink bg-cream px-3 py-3 text-sm font-bold text-ink transition-colors hover:bg-flockie-coral hover:text-white disabled:opacity-50"
                    >
                      <span className="mr-1">{a.emoji}</span> {a.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder="Something else…"
                    maxLength={60}
                    className="h-11 w-full rounded-full border-2 border-ink px-4 text-sm font-medium outline-none"
                  />
                  <button
                    type="button"
                    disabled={busy || !custom.trim()}
                    onClick={() => send(custom)}
                    className="shrink-0 rounded-full border-2 border-ink bg-flockie-coral px-5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
                {error && <p className="mt-2 text-sm font-bold text-red-700">{error}</p>}
                <button
                  type="button"
                  onClick={close}
                  disabled={busy}
                  className="mt-3 text-sm font-bold text-muted underline disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
