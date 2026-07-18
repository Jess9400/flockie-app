"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";

export default function MatchBackButton({ personId, name }: { personId: string; name: string }) {
  const t = useTranslations("components");
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function matchBack() {
    setBusy(true);
    setErr(null);
    const { data, error } = await supabase.rpc("buddy_swipe", {
      p_target: personId,
      p_liked: true,
      p_activity_title: null,
    });
    if (error) {
      setBusy(false);
      setErr(
        error.message.includes("blocked_by_preferences")
          ? t("matchBack.errConflict")
          : t("matchBack.errFailed")
      );
      return;
    }
    const res = data as { matched: boolean; chat_id?: string } | null;
    if (res?.matched && res.chat_id) {
      router.push(`/buddies/${res.chat_id}`);
    } else {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-ink/15 bg-flockie-orange/10 p-4">
      <p className="text-sm font-bold text-ink">{t("matchBack.prompt", { name })}</p>
      <p className="mt-0.5 text-xs font-medium text-ink/70">
        {t("matchBack.subprompt")}
      </p>
      <button
        onClick={matchBack}
        disabled={busy}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-flockie-orange py-3 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:opacity-50"
      >
        <Heart size={16} fill="currentColor" /> {busy ? "…" : t("matchBack.button")}
      </button>
      {err && <p className="mt-2 text-xs font-bold text-red-700">{err}</p>}
    </div>
  );
}
