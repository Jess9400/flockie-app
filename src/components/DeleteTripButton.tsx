"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useConfirm, useToast } from "@/components/ui/feedback";

// Owner-only delete for a trip / activity / flock (My Trips). Confirms, calls
// the delete_trip RPC, then refreshes the list.
export default function DeleteTripButton({ tripId, label }: { tripId: string; label?: string }) {
  const router = useRouter();
  const t = useTranslations("components");
  const confirm = useConfirm();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function del() {
    if (
      !(await confirm({
        title: t("deleteTrip.title", { label: label ?? t("deleteTrip.defaultTarget") }),
        message: t("deleteTrip.message"),
        confirmLabel: t("deleteTrip.confirm"),
        destructive: true,
      }))
    )
      return;
    setBusy(true);
    const { error } = await createClient().rpc("delete_trip", { p_trip: tripId });
    if (error) {
      setBusy(false);
      toast(error.message, "error");
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={del}
      disabled={busy}
      aria-label={t("deleteTrip.confirm")}
      className="flex shrink-0 items-center gap-1 rounded-full border-2 border-ink bg-white px-3 py-1.5 text-sm font-bold text-flockie-coral disabled:opacity-50"
    >
      <Trash2 size={14} /> {busy ? "…" : t("deleteTrip.confirm")}
    </button>
  );
}
