"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, UserPlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { InterestStatus } from "@/lib/vibes";

export type HostVibeCandidate = {
  userId: string;
  status: InterestStatus;
  matchScore: number | null;
  createdAt: string | null;
  invitationExpiresAt: string | null;
  profile: {
    displayName: string | null;
    photos: string[] | null;
    oneLiner: string | null;
    age: number | null;
    homeCity: string | null;
  };
};

function statusCopy(status: InterestStatus) {
  if (status === "standby") return "Standby";
  if (status === "invited") return "Invite sent";
  return "Interested";
}

function formatRequestedAt(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function HostVibeApplicants({
  vibeId,
  capacity,
  confirmedCount,
  activeInviteCount,
  candidates,
}: {
  vibeId: string;
  capacity: number;
  confirmedCount: number;
  activeInviteCount: number;
  candidates: HostVibeCandidate[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState(candidates);
  const [limit, setLimit] = useState(capacity);
  const [activeInvites, setActiveInvites] = useState(activeInviteCount);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const isFull = confirmedCount + activeInvites >= limit;

  function isActiveInvite(candidate: HostVibeCandidate) {
    return (
      candidate.status === "invited" &&
      (!candidate.invitationExpiresAt || new Date(candidate.invitationExpiresAt) > new Date())
    );
  }

  async function approve(userId: string) {
    setBusyKey(`approve:${userId}`);
    setMsg(null);
    const { error } = await supabase.rpc("host_invite_interest", {
      p_vibe: vibeId,
      p_user: userId,
    });
    setBusyKey(null);
    if (error) return setMsg(error.message);
    setItems((prev) =>
      prev.map((item) =>
        item.userId === userId ? { ...item, status: "invited", invitationExpiresAt: null } : item
      )
    );
    setActiveInvites((value) => value + 1);
    setMsg("Invite sent — they still need to confirm.");
    router.refresh();
  }

  async function makeRoomAndInvite(userId: string) {
    if (!window.confirm("Increase this Vibe's capacity by 1 and invite this person?")) return;
    setBusyKey(`make-room:${userId}`);
    setMsg(null);
    const { data, error } = await supabase.rpc("host_make_room_invite_interest", {
      p_vibe: vibeId,
      p_user: userId,
    });
    setBusyKey(null);
    if (error) return setMsg(error.message);
    const result = data as { capacity?: number } | null;
    if (typeof result?.capacity === "number") setLimit(result.capacity);
    setActiveInvites((value) => value + 1);
    setItems((prev) =>
      prev.map((item) =>
        item.userId === userId ? { ...item, status: "invited", invitationExpiresAt: null } : item
      )
    );
    setMsg("Capacity increased by 1 and invite sent.");
    router.refresh();
  }

  async function deny(userId: string) {
    const candidate = items.find((item) => item.userId === userId);
    setBusyKey(`deny:${userId}`);
    setMsg(null);
    const { error } = await supabase.rpc("host_decline_interest", {
      p_vibe: vibeId,
      p_user: userId,
    });
    setBusyKey(null);
    if (error) return setMsg(error.message);
    setItems((prev) => prev.filter((item) => item.userId !== userId));
    if (candidate && isActiveInvite(candidate)) {
      setActiveInvites((value) => Math.max(value - 1, 0));
    }
    setMsg("Request denied.");
    router.refresh();
  }

  return (
    <div className="mt-4 rounded-2xl border-2 border-ink bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold">Host review</p>
          <p className="mt-1 text-xs font-semibold text-muted">
            Approve sends an invite. They join only after they confirm.
          </p>
          <p className="mt-1 text-xs font-semibold text-muted">
            Capacity: {confirmedCount + activeInvites}/{limit} spots held or going.
          </p>
        </div>
        <span className="rounded-full bg-cream px-3 py-1 text-xs font-extrabold">
          {items.length} pending
        </span>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-cream p-3 text-sm font-bold text-muted">
          No one is waiting for host review yet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((candidate) => {
            const name = candidate.profile.displayName || "A flockie";
            const photo = candidate.profile.photos?.[0] ?? null;
            const requestedAt = formatRequestedAt(candidate.createdAt);
            const canApprove = candidate.status === "interested" || candidate.status === "standby";
            const shouldMakeRoom = canApprove && isFull;

            return (
              <div key={candidate.userId} className="rounded-2xl border-2 border-ink bg-cream p-3">
                <div className="flex gap-3">
                  {photo ? (
                    <Image
                      src={photo}
                      alt=""
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-full border-2 border-white object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-flockie-blue font-black text-white">
                      {name[0]}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-extrabold">{name}</p>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-extrabold text-muted">
                        {statusCopy(candidate.status)}
                      </span>
                      {candidate.matchScore !== null && (
                        <span className="rounded-full bg-flockie-orange px-2 py-0.5 text-[11px] font-extrabold text-white">
                          {Math.round(candidate.matchScore)}% match
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      {[candidate.profile.age, candidate.profile.homeCity, requestedAt && `asked ${requestedAt}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {candidate.profile.oneLiner && (
                      <p className="mt-1 line-clamp-2 text-xs font-medium text-ink/70">
                        {candidate.profile.oneLiner}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      shouldMakeRoom ? makeRoomAndInvite(candidate.userId) : approve(candidate.userId)
                    }
                    disabled={!canApprove || busyKey !== null}
                    className="flex items-center justify-center gap-1 rounded-full border-2 border-ink bg-flockie-orange py-2 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {shouldMakeRoom ? <UserPlus size={15} /> : <Check size={15} />}
                    {candidate.status === "invited" ? "Invited" : shouldMakeRoom ? "Make room + invite" : "Approve"}
                  </button>
                  <button
                    onClick={() => deny(candidate.userId)}
                    disabled={busyKey !== null}
                    className="flex items-center justify-center gap-1 rounded-full border-2 border-ink bg-white py-2 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <X size={15} /> Deny
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {msg && <p className="mt-3 text-center text-sm font-bold text-flockie-blue">{msg}</p>}
    </div>
  );
}
