"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

// Club members spend their lifetime guest quota (paid 3 / free 1) to mint a
// one-time link that confirms a guest straight into this gathering.
export default function BringGuestButton({
  vibeId,
  initialRemaining,
}: {
  vibeId: string;
  initialRemaining: number;
}) {
  const supabase = createClient();
  const t = useTranslations("vibes");
  const [remaining, setRemaining] = useState(initialRemaining);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function invite() {
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc("create_club_guest_invite", { p_vibe: vibeId });
    setBusy(false);
    if (error) return setMsg(error.message);
    const result = data as { invite_id: string; remaining: number };
    setRemaining(result.remaining);
    const url = `${window.location.origin}/invite/${vibeId}?guest=${result.invite_id}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ url });
        setMsg(t("detail.guestLinkShared"));
        return;
      } catch {
        /* fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setMsg(t("detail.guestLinkCopied"));
    } catch {
      setMsg(url);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={invite}
        disabled={busy || remaining <= 0}
        className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-bold text-ink shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:opacity-50"
      >
        <UserPlus size={15} />
        {remaining > 0 ? t("detail.bringGuest", { count: remaining }) : t("detail.bringGuestNone")}
      </button>
      {msg && <p className="mt-1 break-all text-xs font-bold text-flockie-blue">{msg}</p>}
    </div>
  );
}
