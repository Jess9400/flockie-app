"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export type ConvertAttendee = {
  id: string;
  name: string;
  photo: string | null;
};

const CADENCES = ["weekly", "biweekly", "monthly"] as const;

// "Turn this into a club?" - the vibe that just happened becomes the club's
// first completed gathering; the host picks a rhythm and which attendees to
// invite as founding members.
export default function ConvertVibeToClub({
  vibeId,
  vibeTitle,
  attendees,
}: {
  vibeId: string;
  vibeTitle: string;
  attendees: ConvertAttendee[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("clubs.convert");
  const [title, setTitle] = useState(vibeTitle);
  const [cadence, setCadence] = useState<(typeof CADENCES)[number]>("monthly");
  const [picked, setPicked] = useState<Set<string>>(new Set(attendees.map((a) => a.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("convert_vibe_to_club", {
      p_vibe: vibeId,
      p_title: title.trim() || null,
      p_cadence: cadence,
      p_invitees: Array.from(picked),
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(`/clubs/${data as string}`);
    router.refresh();
  }

  return (
    <div className="rounded-3xl border border-ink/15 bg-white p-5 shadow-[0_2px_10px_rgba(10,37,69,0.08)] sm:p-6">
      <label className="block">
        <span className="mb-1 block text-sm font-bold">{t("nameLabel")}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          className="w-full rounded-2xl border border-ink/25 bg-white px-4 py-2.5 font-medium outline-none focus:border-flockie-blue"
        />
      </label>

      <p className="mt-4 text-sm font-bold">{t("cadenceLabel")}</p>
      <div className="mt-1.5 flex gap-2">
        {CADENCES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCadence(c)}
            className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
              cadence === c
                ? "border-flockie-coral bg-flockie-coral text-white"
                : "border-ink/15 bg-cream text-ink hover:border-flockie-coral/50"
            }`}
          >
            {t(`cadence.${c}`)}
          </button>
        ))}
      </div>

      {attendees.length > 0 && (
        <>
          <p className="mt-5 text-sm font-bold">{t("inviteLabel")}</p>
          <p className="text-xs font-medium text-muted">{t("inviteHint")}</p>
          <div className="mt-2 space-y-2">
            {attendees.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => toggle(a.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 p-2.5 text-left transition-colors ${
                  picked.has(a.id) ? "border-onboarding-green bg-[#E9F6F1]" : "border-ink/10 bg-white"
                }`}
              >
                {a.photo ? (
                  <Image src={a.photo} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-flockie-blue text-sm font-bold text-white">
                    {a.name[0]?.toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{a.name}</span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                    picked.has(a.id) ? "bg-onboarding-green text-white" : "bg-cream text-ink/50"
                  }`}
                >
                  {picked.has(a.id) ? t("invited") : t("skip")}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        disabled={busy || title.trim().length < 3}
        onClick={submit}
        className="mt-5 w-full rounded-full border border-ink/15 bg-flockie-coral py-3 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:opacity-50"
      >
        {busy ? t("creating") : t("createCta")}
      </button>
      {error && <p className="mt-2 text-center text-sm font-bold text-red-700">{error}</p>}
    </div>
  );
}
