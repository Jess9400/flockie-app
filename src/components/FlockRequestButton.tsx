"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";

export default function FlockRequestButton({
  tripId,
  requested,
  compact = false,
  tripPrefsDone,
}: {
  tripId: string;
  requested: boolean;
  compact?: boolean;
  // When explicitly false, joining is gated on the Trip form — show a link to it
  // instead of the request button (request_join_trip would otherwise reject).
  tripPrefsDone?: boolean;
}) {
  const t = useTranslations("components");
  const supabase = createClient();
  const [done, setDone] = useState(requested);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  async function request() {
    setBusy(true);
    setErr(false);
    const { error } = await supabase.rpc("request_join_trip", { p_trip: tripId });
    setBusy(false);
    if (error) return setErr(true);
    setDone(true);
  }

  const sizing = compact ? "px-3 py-1 text-xs" : "px-4 py-2 text-sm";

  if (done) {
    return (
      <span className={`rounded-full border-2 border-ink bg-cream font-bold text-muted ${sizing}`}>
        {t("flockRequest.requested")}
      </span>
    );
  }

  // Trip form not done → can't join a Flock yet. Send them to complete it.
  if (tripPrefsDone === false) {
    return (
      <Link
        href="/match/trip?kind=trip"
        title={t("flockRequest.completePrefsTip")}
        className={`inline-block rounded-full border-2 border-ink bg-flockie-blue font-bold text-white ${sizing}`}
      >
        {compact ? t("flockRequest.completePrefsCompact") : t("flockRequest.completePrefsFull")}
      </Link>
    );
  }

  return (
    <button
      onClick={request}
      disabled={busy}
      title={err ? t("flockRequest.errTip") : undefined}
      className={`rounded-full border-2 border-ink bg-flockie-orange font-bold text-white shadow-[0_3px_0_0_#E0512C] transition-transform active:translate-y-[2px] active:shadow-[0_1px_0_0_#E0512C] disabled:opacity-50 ${sizing}`}
    >
      {err ? t("flockRequest.tryAgain") : t("flockRequest.requestToJoin")}
    </button>
  );
}
