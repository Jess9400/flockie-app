"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useConfirm } from "@/components/ui/feedback";

type Request = { id: string; display_name: string | null; photos: string[] | null };

export default function ClubMembershipRequests({ clubId, requests }: { clubId: string; requests: Request[] }) {
  const supabase = createClient();
  const router = useRouter();
  const confirm = useConfirm();
  const t = useTranslations("clubs.membership");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(userId: string, decision: "approve" | "decline") {
    setError(null);
    if (decision === "decline") {
      const confirmed = await confirm({
        title: t("declineTitle"),
        message: t("declineBody"),
        confirmLabel: t("declineConfirm"),
        cancelLabel: t("cancel"),
        destructive: true,
      });
      if (!confirmed) return;
    }
    setBusyId(userId);
    const { error: rpcError } = await supabase.rpc(
      decision === "approve" ? "approve_club_membership" : "decline_club_membership",
      { p_club: clubId, p_user: userId }
    );
    setBusyId(null);
    if (rpcError) {
      setError(rpcError.message || t("decisionError"));
      return;
    }
    router.refresh();
  }

  if (!requests.length) return null;

  return (
    <section className="mt-5 rounded-3xl border border-ink/15 bg-white p-5 shadow-[0_2px_10px_rgba(10,37,69,0.08)] sm:p-6">
      <h2 className="text-lg font-black text-ink">{t("hostTitle")}</h2>
      <p className="mt-1 text-sm font-medium leading-relaxed text-muted">{t("hostBody")}</p>
      <div className="mt-5 space-y-2">
        {requests.map((request) => (
          <div key={request.id} className="flex flex-col gap-3 rounded-2xl border border-ink/15 bg-cream p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              {request.photos?.[0] ? (
                <Image src={request.photos[0]} alt="" width={38} height={38} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-flockie-blue text-sm font-bold text-white">{(request.display_name || "F")[0]}</span>
              )}
              <p className="truncate text-sm font-extrabold text-ink">{request.display_name || "Flockie"}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                disabled={busyId === request.id}
                onClick={() => decide(request.id, "approve")}
                className="inline-flex items-center justify-center gap-1 rounded-full bg-flockie-coral px-3 py-2 text-xs font-extrabold text-white disabled:opacity-60"
              >
                <Check size={15} /> {busyId === request.id ? t("approving") : t("approve")}
              </button>
              <button
                type="button"
                disabled={busyId === request.id}
                onClick={() => decide(request.id, "decline")}
                className="inline-flex items-center justify-center gap-1 rounded-full border-2 border-red-200 bg-white px-3 py-2 text-xs font-extrabold text-red-700 disabled:opacity-60"
              >
                <X size={15} /> {busyId === request.id ? t("declining") : t("decline")}
              </button>
            </div>
          </div>
        ))}
      </div>
      {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
    </section>
  );
}
