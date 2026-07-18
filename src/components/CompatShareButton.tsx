"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

// Shares a "how compatible are we?" link → friend takes the vibe check to find out.
export default function CompatShareButton({
  userId,
  variant = "primary",
  label,
}: {
  userId: string;
  variant?: "primary" | "ghost";
  label?: string;
}) {
  const t = useTranslations("components");
  const [copied, setCopied] = useState(false);
  const url = `https://app.findflockie.com/compat/${userId}`;
  const text = t("compatShare.shareText");

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: t("compatShare.shareTitle"), text, url });
        return;
      } catch {
        // cancelled / unsupported — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  const cls =
    variant === "primary"
      ? "bg-flockie-blue text-white"
      : "bg-white text-navy";

  return (
    <button
      type="button"
      onClick={share}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-navy/15 px-5 py-2.5 font-fredoka text-sm font-semibold ${cls}`}
    >
      {copied ? t("compatShare.copied") : label ?? t("compatShare.defaultLabel")}
    </button>
  );
}
