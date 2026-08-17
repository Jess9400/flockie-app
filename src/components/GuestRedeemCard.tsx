"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

// Landing state for a one-time club guest invite link: one tap confirms the
// guest into the gathering (auto-confirm model - chat + location unlock).
export default function GuestRedeemCard({ inviteId }: { inviteId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("vibes");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function redeem() {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("redeem_club_guest_invite", { p_invite: inviteId });
    setBusy(false);
    if (error) return setErr(error.message);
    router.refresh();
  }

  return (
    <section className="mt-5 rounded-3xl border border-ink/15 bg-white p-6 text-center shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
      <p className="text-3xl">💌</p>
      <h2 className="mt-2 text-lg font-black text-ink">{t("detail.guestCardTitle")}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm font-medium text-muted">{t("detail.guestCardBody")}</p>
      <button
        type="button"
        onClick={redeem}
        disabled={busy}
        className="mt-4 rounded-full border border-ink/15 bg-flockie-orange px-6 py-2.5 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:opacity-50"
      >
        {t("detail.guestAccept")}
      </button>
      {err && <p className="mt-2 text-sm font-bold text-flockie-coral">{err}</p>}
    </section>
  );
}
