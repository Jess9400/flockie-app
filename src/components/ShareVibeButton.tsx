"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { useTranslations } from "next-intl";

export default function ShareVibeButton({
  vibeId,
  tile,
  fill,
  inviteCode,
}: {
  vibeId: string;
  tile?: boolean;
  fill?: boolean;
  // Club gatherings are invite-only: the shared link carries the host's code
  // so the recipient can actually get in ("join with host code" flow).
  inviteCode?: string;
}) {
  const t = useTranslations("vibes");
  const [copied, setCopied] = useState(false);

  async function share() {
    const url =
      `${window.location.origin}/invite/${vibeId}` +
      (inviteCode ? `?code=${encodeURIComponent(inviteCode)}` : "");
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: t("share.shareTitle"), url });
        return;
      } catch {
        // user cancelled or unsupported - fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  // Coral "Share to fill" pill - the primary action on a hosting card while
  // seats are still open (My Vibes).
  if (fill) {
    return (
      <button
        type="button"
        onClick={share}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink/15 bg-flockie-coral px-3.5 py-1.5 text-xs font-extrabold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
      >
        <Share2 size={14} /> {copied ? t("share.linkCopied") : t("share.fill")}
      </button>
    );
  }

  // Compact tile for the side-by-side host action row.
  if (tile) {
    return (
      <button
        type="button"
        onClick={share}
        className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-ink/15 bg-white py-3 text-[11px] font-bold text-ink"
      >
        <Share2 size={18} /> {copied ? t("share.copiedTile") : t("share.share")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-bold text-ink"
    >
      <Share2 size={15} /> {copied ? t("share.linkCopied") : t("share.share")}
    </button>
  );
}
