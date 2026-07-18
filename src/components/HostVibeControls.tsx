"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import ShareVibeButton from "@/components/ShareVibeButton";

export default function HostVibeControls({
  vibeId,
  status,
}: {
  vibeId: string;
  status: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations("vibes");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (status === "cancelled") {
    return (
      <div className="rounded-full border border-ink/15 bg-cream py-3 text-center font-bold text-muted">
        {t("host.youCancelled")}
      </div>
    );
  }

  async function run() {
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc("rank_vibe", { p_vibe: vibeId });
    setBusy(false);
    if (error) return setMsg(error.message);
    const r = data as { shortlisted?: number; standby?: number };
    setMsg(t("host.shortlistReady", { shortlisted: r.shortlisted ?? 0, standby: r.standby ?? 0 }));
    router.refresh();
  }

  const tile = "flex flex-col items-center justify-center gap-1 rounded-2xl border border-ink/15 py-3 text-[11px] font-bold disabled:opacity-50";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <button onClick={run} disabled={busy} className={`${tile} bg-flockie-orange text-white`}>
          <Sparkles size={18} /> {busy ? t("host.running") : t("host.runMatching")}
        </button>
        <ShareVibeButton vibeId={vibeId} tile />
        <Link href={`/vibes/${vibeId}/chat`} className={`${tile} bg-flockie-blue text-white`}>
          <MessageCircle size={18} /> {t("host.openChat")}
        </Link>
      </div>
      <p className="px-2 text-center text-xs font-medium text-muted">
        {t("host.autoInviteNote")}
      </p>
      {msg && <p className="text-center text-sm font-bold text-flockie-blue">{msg}</p>}
    </div>
  );
}
