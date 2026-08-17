"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

// Club members are already in the club - the gathering only needs a head
// count. One tap confirms attendance (seat + attendance stamp in one motion,
// see vibe-express-interest-autoconfirm.sql).
export default function ConfirmAttendanceButton({ vibeId }: { vibeId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("vibes");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("express_interest", { p_vibe: vibeId });
    setBusy(false);
    if (error) return setErr(error.message);
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={confirm}
        disabled={busy}
        className="w-full rounded-full border border-ink/15 bg-flockie-orange py-3.5 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:opacity-50"
      >
        {t("detail.confirmAttendance")}
      </button>
      <p className="mt-1.5 text-center text-xs font-medium text-muted">{t("detail.confirmAttendanceHint")}</p>
      {err && <p className="mt-2 text-center text-sm font-bold text-flockie-coral">{err}</p>}
    </div>
  );
}
