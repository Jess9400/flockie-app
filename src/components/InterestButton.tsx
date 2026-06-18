"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { InterestStatus } from "@/lib/vibes";

type Props = {
  vibeId: string;
  userId: string;
  profileComplete: boolean;
  initialStatus: InterestStatus | null;
};

export default function InterestButton({
  vibeId,
  userId,
  profileComplete,
  initialStatus,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<InterestStatus | null>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState(false);

  async function express() {
    if (!profileComplete) {
      setGate(true);
      return;
    }
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
    await supabase.from("vibe_interests").delete().eq("vibe_id", vibeId).eq("user_id", userId);
    setBusy(false);
    setStatus(null);
    router.refresh();
  }

  async function confirm() {
    setBusy(true);
    const { error } = await supabase.rpc("confirm_vibe", { p_vibe: vibeId });
    setBusy(false);
    if (!error) {
      setStatus("confirmed");
      router.refresh();
    }
  }

  async function decline() {
    setBusy(true);
    await supabase
      .from("vibe_interests")
      .update({ status: "declined" })
      .eq("vibe_id", vibeId)
      .eq("user_id", userId);
    setBusy(false);
    setStatus("declined");
    router.refresh();
  }

  const base =
    "w-full rounded-full border-2 border-ink py-3.5 text-center font-bold disabled:opacity-50";

  let control: React.ReactNode;

  if (status === "confirmed") {
    control = (
      <div className="space-y-2">
        <div className={`${base} bg-[#06D6A0] text-white`}>You&rsquo;re in 🎉</div>
        <Link href={`/vibes/${vibeId}/chat`} className={`${base} block bg-flockie-blue text-white`}>
          Open Vibing Chat
        </Link>
      </div>
    );
  } else if (status === "invited") {
    control = (
      <div className="space-y-2">
        <button onClick={confirm} disabled={busy} className={`${base} bg-flockie-orange text-white shadow-[0_4px_0_0_#E0512C]`}>
          Confirm spot
        </button>
        <button onClick={decline} disabled={busy} className={`${base} bg-white`}>
          Decline
        </button>
      </div>
    );
  } else if (status === "standby") {
    control = (
      <div className={`${base} bg-cream`}>
        On standby — we&rsquo;ll show you Vibes that match your style.
      </div>
    );
  } else if (status === "interested") {
    control = (
      <button onClick={untap} disabled={busy} className={`${base} bg-cream`}>
        You&rsquo;re in the running · tap to remove
      </button>
    );
  } else {
    control = (
      <button onClick={express} disabled={busy} className={`${base} bg-flockie-orange text-white shadow-[0_4px_0_0_#E0512C]`}>
        I&rsquo;m interested
      </button>
    );
  }

  return (
    <>
      {control}

      {gate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl border-2 border-ink bg-white p-6 shadow-[0_8px_0_0_rgba(26,26,26,1)]">
            <p className="text-xl font-black">Finish your vibe check first 🪶</p>
            <p className="mt-2 text-sm font-medium text-ink/70">
              We match you on your vibe-check answers. Complete it so the host
              gets the most compatible people — including you.
            </p>
            <Link
              href="/profile"
              className="mt-5 block rounded-full border-2 border-ink bg-flockie-orange py-3 text-center font-bold text-white shadow-[0_4px_0_0_#E0512C]"
            >
              Complete my vibe check
            </Link>
            <button
              onClick={() => setGate(false)}
              className="mt-2 w-full rounded-full py-2 text-center text-sm font-bold text-muted"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </>
  );
}
