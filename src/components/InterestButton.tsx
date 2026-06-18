"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { InterestStatus } from "@/lib/vibes";

type Props = {
  vibeId: string;
  userId: string;
  isHost: boolean;
  activityCheckDone: boolean;
  initialStatus: InterestStatus | null;
};

export default function InterestButton({
  vibeId,
  userId,
  isHost,
  activityCheckDone,
  initialStatus,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<InterestStatus | null>(initialStatus);
  const [busy, setBusy] = useState(false);

  async function express() {
    setBusy(true);
    const { error } = await supabase
      .from("vibe_interests")
      .insert({ vibe_id: vibeId, user_id: userId, status: "interested" });
    setBusy(false);
    if (!error) {
      setStatus("interested");
      router.refresh();
    }
  }

  async function untap() {
    setBusy(true);
    await supabase
      .from("vibe_interests")
      .delete()
      .eq("vibe_id", vibeId)
      .eq("user_id", userId);
    setBusy(false);
    setStatus(null);
    router.refresh();
  }

  async function setTo(next: InterestStatus) {
    setBusy(true);
    await supabase
      .from("vibe_interests")
      .update({
        status: next,
        confirmed_at: next === "confirmed" ? new Date().toISOString() : null,
      })
      .eq("vibe_id", vibeId)
      .eq("user_id", userId);
    setBusy(false);
    setStatus(next);
    router.refresh();
  }

  if (isHost) {
    return (
      <Link
        href={`/vibes/${vibeId}/edit`}
        className="block w-full rounded-full border-2 border-ink bg-white py-3.5 text-center font-bold"
      >
        You&rsquo;re the host · manage
      </Link>
    );
  }

  if (!activityCheckDone) {
    return (
      <Link
        href="/profile"
        className="block w-full rounded-full border-2 border-ink bg-flockie-blue py-3.5 text-center font-bold text-white"
      >
        Complete your activity vibe check to join
      </Link>
    );
  }

  const base =
    "w-full rounded-full border-2 border-ink py-3.5 text-center font-bold disabled:opacity-50";

  if (status === "confirmed") {
    return (
      <div className="space-y-2">
        <div className={`${base} bg-[#06D6A0] text-white`}>You&rsquo;re in 🎉</div>
        <Link
          href={`/vibes/${vibeId}/chat`}
          className={`${base} block bg-flockie-blue text-white`}
        >
          Open Vibing Chat
        </Link>
      </div>
    );
  }

  if (status === "invited") {
    return (
      <div className="space-y-2">
        <button
          onClick={() => setTo("confirmed")}
          disabled={busy}
          className={`${base} bg-flockie-orange text-white shadow-[0_4px_0_0_#E0512C]`}
        >
          Confirm spot
        </button>
        <button
          onClick={() => setTo("declined")}
          disabled={busy}
          className={`${base} bg-white`}
        >
          Decline
        </button>
      </div>
    );
  }

  if (status === "standby") {
    return (
      <div className={`${base} bg-cream`}>
        On standby — we&rsquo;ll show you Vibes that match your style.
      </div>
    );
  }

  if (status === "interested") {
    return (
      <button onClick={untap} disabled={busy} className={`${base} bg-cream`}>
        You&rsquo;re in the running · tap to remove
      </button>
    );
  }

  return (
    <button
      onClick={express}
      disabled={busy}
      className={`${base} bg-flockie-orange text-white shadow-[0_4px_0_0_#E0512C]`}
    >
      I&rsquo;m interested
    </button>
  );
}
