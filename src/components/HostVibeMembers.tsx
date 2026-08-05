"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useConfirm } from "@/components/ui/feedback";

type HostVibeMember = {
  id: string;
  display_name: string | null;
  photos: string[] | null;
  status: "invited" | "confirmed";
  attendance_confirmed_at?: string | null;
};

type Props = {
  vibeId: string;
  members: HostVibeMember[];
  eventStarted: boolean;
  normalRemovalLimit: number;
  normalRemovalUsed: number;
};

type RemovalReason = "known_conflict" | "other" | "safety";

export default function HostVibeMembers({
  vibeId,
  members,
  eventStarted,
  normalRemovalLimit,
  normalRemovalUsed,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const confirm = useConfirm();
  const t = useTranslations("vibes");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function removeMember(member: HostVibeMember) {
    // After the event starts, only safety removals are allowed.
    const reasonChoices = eventStarted
      ? [{ value: "safety", label: t("host.reasonSafety") }]
      : [
          { value: "known_conflict", label: t("host.reasonKnownConflict") },
          { value: "other", label: t("host.reasonOther") },
          { value: "safety", label: t("host.reasonSafety") },
        ];

    const res = await confirm({
      title: t("host.removeTitle", { name: member.display_name || t("host.removePersonFallback") }),
      message: eventStarted
        ? t("host.removeMsgStarted")
        : t("host.removeMsgPick"),
      reasons: reasonChoices,
      reasonRequired: true,
      allowFreeText: true,
      freeTextPlaceholder: t("host.removeNotePlaceholder"),
      confirmLabel: t("host.remove"),
      destructive: true,
    });
    if (!res) return;

    const reason = res.value as RemovalReason;
    const note = res.note || null;
    // Other / Safety removals require a private note for Flockie.
    if ((reason === "other" || reason === "safety") && !note) {
      setMessage(t("host.noteRequired"));
      return;
    }

    setBusyId(member.id);
    setMessage(null);
    const { error } = await supabase.rpc("host_remove_vibe_member", {
      p_vibe: vibeId,
      p_user: member.id,
      p_reason: reason,
      p_note: note,
    });
    setBusyId(null);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(t("host.removedResult", { name: member.display_name || t("host.memberFallback") }));
    router.refresh();
  }

  if (!members.length) return null;

  return (
    <div className="mt-6 rounded-2xl border border-ink/15 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold">{t("host.invitedGoing")}</p>
          <p className="mt-0.5 text-xs font-medium text-muted">
            {t("host.removalsCount", { used: normalRemovalUsed, limit: normalRemovalLimit })}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {members.map((member) => (
          <div key={member.id} className="flex items-center justify-between gap-3 rounded-2xl bg-cream p-2">
            <div className="flex min-w-0 items-center gap-2">
              {member.photos?.[0] ? (
                <Image
                  src={member.photos[0]}
                  alt=""
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-flockie-blue text-xs font-bold text-white">
                  {(member.display_name || "F")[0]}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold">{member.display_name || t("host.attendeeFallback")}</p>
                <p className="text-[11px] font-bold text-muted">
                  {member.status === "confirmed"
                    ? member.attendance_confirmed_at
                      ? t("host.statusRsvped")
                      : t("host.statusGoing")
                    : t("host.statusInvited")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeMember(member)}
              disabled={busyId === member.id}
              className="rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-extrabold disabled:opacity-50"
            >
              {busyId === member.id ? t("host.removing") : t("host.remove")}
            </button>
          </div>
        ))}
      </div>

      {message && <p className="mt-3 text-center text-xs font-bold text-flockie-blue">{message}</p>}
    </div>
  );
}
