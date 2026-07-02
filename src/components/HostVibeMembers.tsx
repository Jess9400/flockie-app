"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useConfirm } from "@/components/ui/feedback";

type HostVibeMember = {
  id: string;
  display_name: string | null;
  photos: string[] | null;
  status: "invited" | "confirmed";
};

type Props = {
  vibeId: string;
  members: HostVibeMember[];
  eventStarted: boolean;
  normalRemovalLimit: number;
  normalRemovalUsed: number;
};

const reasonLabels = {
  known_conflict: "Known conflict",
  other: "Other",
  safety: "Safety concern",
} as const;

type RemovalReason = keyof typeof reasonLabels;

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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function removeMember(member: HostVibeMember) {
    // After the event starts, only safety removals are allowed.
    const reasonChoices = eventStarted
      ? [{ value: "safety", label: reasonLabels.safety }]
      : [
          { value: "known_conflict", label: reasonLabels.known_conflict },
          { value: "other", label: reasonLabels.other },
          { value: "safety", label: reasonLabels.safety },
        ];

    const res = await confirm({
      title: `Remove ${member.display_name || "this person"}?`,
      message: eventStarted
        ? "After the Vibe starts, only safety removals are available."
        : "Pick a reason. This is private to Flockie.",
      reasons: reasonChoices,
      reasonRequired: true,
      allowFreeText: true,
      freeTextPlaceholder: "Private note (required for Other / Safety)",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!res) return;

    const reason = res.value as RemovalReason;
    const note = res.note || null;
    // Other / Safety removals require a private note for Flockie.
    if ((reason === "other" || reason === "safety") && !note) {
      setMessage("Please add a short private note for that reason.");
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

    setMessage(`${member.display_name || "Member"} was removed. Flockie will backfill if possible.`);
    router.refresh();
  }

  if (!members.length) return null;

  return (
    <div className="mt-6 rounded-2xl border-2 border-ink bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold">Invited &amp; going</p>
          <p className="mt-0.5 text-xs font-medium text-muted">
            Normal removals: {normalRemovalUsed}/{normalRemovalLimit}. Safety removals require a note and don&rsquo;t count.
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
                <p className="truncate text-sm font-extrabold">{member.display_name || "Flockie"}</p>
                <p className="text-[11px] font-bold text-muted">
                  {member.status === "confirmed" ? "Going" : "Invited"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeMember(member)}
              disabled={busyId === member.id}
              className="rounded-full border-2 border-ink bg-white px-3 py-1.5 text-xs font-extrabold disabled:opacity-50"
            >
              {busyId === member.id ? "Removing…" : "Remove"}
            </button>
          </div>
        ))}
      </div>

      {message && <p className="mt-3 text-center text-xs font-bold text-flockie-blue">{message}</p>}
    </div>
  );
}
