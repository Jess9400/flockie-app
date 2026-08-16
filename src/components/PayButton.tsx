"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

// Starts a provider checkout for a socio membership or a store order and
// redirects to the hosted payment page. The webhook settles the record -
// see /api/pay/checkout and supabase/club-payments.sql.
export default function PayButton({
  kind,
  clubId,
  orderId,
  months,
  className,
}: {
  kind: "socio" | "order";
  clubId: string;
  orderId?: string;
  months?: number;
  className?: string;
}) {
  const t = useTranslations("clubs.pay");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/pay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, clubId, orderId, months }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setErr(data.error ?? t("error"));
        setBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setErr(t("error"));
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={pay}
        disabled={busy}
        className={
          className ??
          "rounded-full border border-ink/15 bg-flockie-blue px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        }
      >
        {busy ? t("redirecting") : t("payCrypto")}
      </button>
      {err && <span className="mt-1 text-xs font-bold text-flockie-coral">{err}</span>}
    </span>
  );
}
