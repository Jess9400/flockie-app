"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useConfirm } from "@/components/ui/feedback";

type Attendee = { id: string; display_name: string | null; photos: string[] | null };

export default function ClubAttendancePanel({
  clubId,
  vibeId,
  attendees,
  recordedIds,
}: {
  clubId: string;
  vibeId: string;
  attendees: Attendee[];
  recordedIds: string[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const confirm = useConfirm();
  const t = useTranslations("clubs.attendance");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorded = new Set(recordedIds);
  const available = attendees.filter((attendee) => !recorded.has(attendee.id));

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  async function recordAttendance() {
    if (!selected.length) return;
    const result = await confirm({
      title: t("confirmTitle"),
      message: t("confirmBody"),
      confirmLabel: t("confirm"),
      cancelLabel: t("cancel"),
    });
    if (!result) return;

    setError(null);
    setSaving(true);
    const outcomes = await Promise.all(
      selected.map(async (userId) => {
        const { error: rpcError } = await supabase.rpc("record_club_attendance", {
          p_club: clubId,
          p_vibe: vibeId,
          p_user: userId,
        });
        return rpcError;
      })
    );
    setSaving(false);
    const firstError = outcomes.find(Boolean);
    if (firstError) {
      setError(firstError.message || t("error"));
      router.refresh();
      return;
    }
    setSelected([]);
    router.refresh();
  }

  if (!attendees.length) return null;

  return (
    <section className="mt-6 rounded-[2rem] border border-flockie-blue/30 bg-white p-5 shadow-[0_8px_30px_rgba(10,37,69,0.05)] sm:p-6">
      <div className="flex gap-3">
        <ClipboardCheck className="mt-0.5 shrink-0 text-flockie-coral" size={23} />
        <div>
          <h2 className="text-lg font-black text-ink">{t("title")}</h2>
          <p className="mt-1 text-sm font-medium leading-relaxed text-muted">{t("body")}</p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {attendees.map((attendee) => {
          const isRecorded = recorded.has(attendee.id);
          const isSelected = selected.includes(attendee.id);
          return (
            <label
              key={attendee.id}
              className={`flex items-center justify-between gap-3 rounded-2xl border p-3 ${
                isRecorded ? "border-flockie-blue/30 bg-flockie-blue/10" : isSelected ? "border-flockie-coral bg-orange-50" : "border-ink/15 bg-cream"
              } ${isRecorded ? "cursor-default" : "cursor-pointer"}`}
            >
              <span className="flex min-w-0 items-center gap-3">
                {attendee.photos?.[0] ? (
                  <Image src={attendee.photos[0]} alt="" width={38} height={38} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-flockie-blue text-sm font-bold text-white">
                    {(attendee.display_name || "F")[0]}
                  </span>
                )}
                <span className="truncate text-sm font-extrabold text-ink">{attendee.display_name || "Flockie"}</span>
              </span>
              {isRecorded ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-extrabold text-flockie-blue"><Check size={15} /> {t("recorded")}</span>
              ) : (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(attendee.id)}
                  className="h-5 w-5 accent-[#ff6b4a]"
                  aria-label={attendee.display_name || "Flockie"}
                />
              )}
            </label>
          );
        })}
      </div>

      {available.length > 0 && (
        <button
          type="button"
          disabled={saving || selected.length === 0}
          onClick={recordAttendance}
          className="mt-5 w-full rounded-full bg-flockie-coral px-5 py-3 text-sm font-extrabold text-white shadow-[0_3px_0_#d84e32] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {saving
            ? t("recording")
            : selected.length === 1
              ? t("record", { count: selected.length })
              : t("recordPlural", { count: selected.length })}
        </button>
      )}
      {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
    </section>
  );
}
