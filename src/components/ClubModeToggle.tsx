"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

// Host control: who keeps the club meeting — the host, or Flockie's automatic
// heartbeat (schedules the next gathering on cadence, same time same place).
export default function ClubModeToggle({
  clubId,
  mode,
}: {
  clubId: string;
  mode: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("clubs.loop");
  const [current, setCurrent] = useState(mode);
  const [busy, setBusy] = useState(false);

  async function set(next: string) {
    if (busy || next === current) return;
    setBusy(true);
    const { error } = await supabase.rpc("set_club_mode", { p_club: clubId, p_mode: next });
    setBusy(false);
    if (!error) {
      setCurrent(next);
      router.refresh();
    }
  }

  return (
    <section className="mt-5 rounded-3xl border border-ink/15 bg-white p-5 shadow-[0_2px_10px_rgba(10,37,69,0.08)] sm:p-6">
      <h2 className="text-lg font-black text-ink">{t("modeTitle")}</h2>
      <p className="mt-1 text-sm font-medium text-muted">{t("modeBody")}</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => set("host_run")}
          className={`rounded-2xl border-2 px-4 py-3 text-left transition-colors disabled:opacity-50 ${
            current === "host_run" ? "border-flockie-coral bg-flockie-coral/5" : "border-ink/10 bg-white"
          }`}
        >
          <span className="block text-sm font-extrabold text-ink">🙋 {t("modeHost")}</span>
          <span className="block text-[11px] font-medium text-muted">{t("modeHostSub")}</span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => set("flockie_assisted")}
          className={`rounded-2xl border-2 px-4 py-3 text-left transition-colors disabled:opacity-50 ${
            current === "flockie_assisted" ? "border-flockie-blue bg-flockie-blue/5" : "border-ink/10 bg-white"
          }`}
        >
          <span className="block text-sm font-extrabold text-ink">🪽 {t("modeAuto")}</span>
          <span className="block text-[11px] font-medium text-muted">{t("modeAutoSub")}</span>
        </button>
      </div>
    </section>
  );
}
