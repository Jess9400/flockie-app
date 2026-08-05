"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

// Soft RSVP for confirmed attendees. Being in the vibe is NOT gated on this -
// invites auto-confirm now (vibe-auto-confirm-invites.sql); this is an
// optional "I'll be there" that the host sees as a planning signal.
export default function RsvpBanner({
  vibeId,
  initialRsvped,
}: {
  vibeId: string;
  initialRsvped: boolean;
}) {
  const supabase = createClient();
  const t = useTranslations("vibes");
  const [rsvped, setRsvped] = useState(initialRsvped);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function rsvp() {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("confirm_attendance", { p_vibe: vibeId });
    setBusy(false);
    if (error) return setErr(error.message);
    setRsvped(true);
  }

  if (rsvped) {
    return (
      <div className="mt-5 flex items-center gap-2 rounded-2xl bg-cream p-3 text-sm font-bold text-ink">
        <span aria-hidden>✅</span> {t("detail.rsvpDone")}
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-2xl border border-ink/15 bg-white p-4 shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
      <p className="font-fredoka text-lg font-bold text-ink">{t("detail.rsvpTitle")}</p>
      <p className="mt-1 text-sm font-medium text-muted">{t("detail.rsvpBody")}</p>
      <button
        type="button"
        onClick={rsvp}
        disabled={busy}
        className="mt-3 w-full rounded-full border border-ink/15 bg-flockie-orange py-2.5 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:opacity-50"
      >
        {t("detail.rsvpButton")}
      </button>
      {err && <p className="mt-2 text-center text-sm font-bold text-flockie-coral">{err}</p>}
    </div>
  );
}
