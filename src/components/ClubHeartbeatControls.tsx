"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarPlus, CirclePause, Play, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useConfirm } from "@/components/ui/feedback";

type ClubStatus = "forming" | "active" | "paused" | "closed";

export default function ClubHeartbeatControls({
  clubId,
  status,
  lastCompletedVibeId,
  nextVibeId,
}: {
  clubId: string;
  status: ClubStatus;
  lastCompletedVibeId: string | null;
  nextVibeId: string | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const confirm = useConfirm();
  const t = useTranslations("clubs.heartbeat");
  const [saving, setSaving] = useState<"active" | "paused" | "resume" | "closed" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(next: "active" | "paused" | "resume" | "closed") {
    setError(null);
    if (next === "closed") {
      const accepted = await confirm({
        title: t("closeTitle"),
        message: t("closeBody"),
        confirmLabel: t("closeConfirm"),
        cancelLabel: t("cancel"),
        destructive: true,
      });
      if (!accepted) return;
    }
    setSaving(next);
    const { error: rpcError } = await supabase.rpc("set_club_status", { p_club: clubId, p_status: next });
    setSaving(null);
    if (rpcError) {
      setError(rpcError.message || t("pauseError"));
      return;
    }
    router.refresh();
  }

  const nextGatheringHref = lastCompletedVibeId
    ? `/vibes/new?club=${clubId}&from=${lastCompletedVibeId}`
    : `/vibes/new?club=${clubId}`;

  if (status === "closed") return null;

  return (
    <section className="mt-5 rounded-3xl border border-ink/15 bg-white p-5 shadow-[0_2px_10px_rgba(10,37,69,0.08)] sm:p-6">
      {status === "forming" && lastCompletedVibeId && (
        <div className="rounded-2xl bg-flockie-blue/10 p-4">
          <div className="flex gap-3">
            <Play className="mt-0.5 shrink-0 text-flockie-coral" size={22} />
            <div>
              <h2 className="text-lg font-black text-ink">{t("readyTitle")}</h2>
              <p className="mt-1 text-sm font-medium leading-relaxed text-muted">{t("readyBody")}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={saving !== null}
            onClick={() => updateStatus("active")}
            className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-flockie-coral px-4 py-3 text-sm font-extrabold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:opacity-60 sm:w-auto"
          >
            {saving === "active" ? t("activating") : t("activate")}
          </button>
        </div>
      )}

      {status === "active" && !nextVibeId && (
        <div className="rounded-2xl bg-flockie-blue/10 p-4">
          <div className="flex gap-3">
            <CalendarPlus className="mt-0.5 shrink-0 text-flockie-coral" size={22} />
            <div>
              <h2 className="text-lg font-black text-ink">{t("activeTitle")}</h2>
              <p className="mt-1 text-sm font-medium leading-relaxed text-muted">{t("activeBody")}</p>
            </div>
          </div>
          <Link href={nextGatheringHref} className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-flockie-coral px-4 py-3 text-sm font-extrabold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] sm:w-auto">
            {t("planNext")}
          </Link>
        </div>
      )}

      {status === "paused" && (
        <div className="rounded-2xl bg-cream p-4">
          <div className="flex gap-3">
            <CirclePause className="mt-0.5 shrink-0 text-flockie-coral" size={22} />
            <div>
              <h2 className="text-lg font-black text-ink">{t("pausedTitle")}</h2>
              <p className="mt-1 text-sm font-medium leading-relaxed text-muted">{t("pausedBody")}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={saving !== null}
            onClick={() => updateStatus("resume")}
            className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-flockie-coral px-4 py-3 text-sm font-extrabold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:opacity-60 sm:w-auto"
          >
            <RotateCcw className="mr-1.5" size={16} /> {saving === "resume" ? t("resuming") : t("resume")}
          </button>
        </div>
      )}

      {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-ink/10 pt-4">
        {(status === "forming" || status === "active") && (
          <button
            type="button"
            disabled={saving !== null}
            onClick={() => updateStatus("paused")}
            className="rounded-full border-2 border-ink/20 bg-white px-4 py-2 text-xs font-extrabold text-ink disabled:opacity-60"
          >
            {saving === "paused" ? t("pausing") : t("pause")}
          </button>
        )}
        <button
          type="button"
          disabled={saving !== null}
          onClick={() => updateStatus("closed")}
          className="rounded-full border-2 border-red-200 bg-white px-4 py-2 text-xs font-extrabold text-red-700 disabled:opacity-60"
        >
          {saving === "closed" ? t("closing") : t("close")}
        </button>
      </div>
    </section>
  );
}
