"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

// Shown on the club page when the viewer has an 'invited' membership (e.g.
// picked as a founding member during a vibe→club conversion).
export default function ClubInviteAccept({ clubId }: { clubId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("clubs.loop");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("accept_club_founder_invitation", { p_club: clubId });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <section className="mt-5 rounded-[2rem] border-2 border-flockie-coral bg-white p-5 shadow-[0_8px_30px_rgba(10,37,69,0.05)] sm:p-6">
      <h2 className="text-lg font-black text-ink">{t("invitedTitle")}</h2>
      <p className="mt-1 text-sm font-medium text-muted">{t("invitedBody")}</p>
      <button
        type="button"
        disabled={busy}
        onClick={accept}
        className="mt-4 w-full rounded-full border border-ink/15 bg-flockie-coral py-3 font-bold text-white disabled:opacity-50 sm:w-auto sm:px-8"
      >
        {busy ? t("accepting") : t("acceptInvite")}
      </button>
      {error && <p className="mt-2 text-sm font-bold text-red-700">{error}</p>}
    </section>
  );
}
