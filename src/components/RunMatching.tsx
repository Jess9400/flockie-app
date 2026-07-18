"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";

export default function RunMatching({
  vibeId,
  status,
}: {
  vibeId: string;
  status: string;
}) {
  const t = useTranslations("components");
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc("rank_vibe", { p_vibe: vibeId });
    setBusy(false);
    if (error) return setMsg(error.message);
    const r = data as { invited: number; standby: number };
    setMsg(t("runMatching.matched", { invited: r.invited, standby: r.standby }));
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="rounded-full border border-ink/15 bg-white py-2.5 text-center text-sm font-bold">
        {t("runMatching.host")}
      </div>
      <button
        onClick={run}
        disabled={busy}
        className="w-full rounded-full border border-ink/15 bg-flockie-orange py-3.5 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:opacity-50"
      >
        {busy ? t("runMatching.running") : status === "open" ? t("runMatching.runNow") : t("runMatching.reRun")}
      </button>
      <Link
        href={`/vibes/${vibeId}/chat`}
        className="block w-full rounded-full border border-ink/15 bg-flockie-blue py-3 text-center font-bold text-white"
      >
        {t("runMatching.openChat")}
      </Link>
      {msg && (
        <p className="text-center text-sm font-bold text-flockie-blue">{msg}</p>
      )}
    </div>
  );
}
