"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ActivityVibeForm from "@/components/ActivityVibeForm";
import type { InterestStatus } from "@/lib/vibes";

type Props = {
  vibeId: string;
  userId: string;
  activitiesDone: boolean;
  initialStatus: InterestStatus | null;
  invitationExpiresAt?: string | null;
  cancelled?: boolean;
  autoInterest?: boolean;
};

export default function InterestButton({
  vibeId,
  userId,
  activitiesDone,
  initialStatus,
  invitationExpiresAt,
  cancelled,
  autoInterest,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<InterestStatus | null>(initialStatus);
  const [hasActivities, setHasActivities] = useState(activitiesDone);
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  function timeLeft(): string {
    if (!invitationExpiresAt) return "";
    const ms = +new Date(invitationExpiresAt) - now;
    if (ms <= 0) return "expiring…";
    const h = Math.floor(ms / 3.6e6);
    const m = Math.floor((ms % 3.6e6) / 6e4);
    return `${h}h ${m}m left`;
  }

  async function doInsert() {
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

  async function express() {
    if (!hasActivities) {
      setGate(true);
      return;
    }
    await doInsert();
  }

  // Invite deep-link: auto-open the interest flow once on arrival.
  useEffect(() => {
    if (autoInterest && status === null && !cancelled) {
      express();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function untap() {
    setBusy(true);
    await supabase.from("vibe_interests").delete().eq("vibe_id", vibeId).eq("user_id", userId);
    setBusy(false);
    setStatus(null);
    router.refresh();
  }

  async function confirm() {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.rpc("confirm_vibe", { p_vibe: vibeId });
    setBusy(false);
    if (!error) {
      setStatus("confirmed");
      router.refresh();
    } else {
      setMessage(error.message);
    }
  }

  async function decline() {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.rpc("decline_vibe", { p_vibe: vibeId });
    setBusy(false);
    if (error) return setMessage(error.message);
    setStatus("declined");
    router.refresh();
  }

  async function leave() {
    if (!window.confirm("Leave this Vibe? Your spot opens up for someone else.")) return;
    setBusy(true);
    await supabase.rpc("decline_vibe", { p_vibe: vibeId });
    setBusy(false);
    setStatus("declined");
    router.refresh();
  }

  const base =
    "w-full rounded-full border-2 border-ink py-3.5 text-center font-bold disabled:opacity-50";

  let control: React.ReactNode;

  if (cancelled) {
    control = (
      <div className={`${base} bg-cream text-muted`}>
        This Vibe was cancelled by the host.
      </div>
    );
  } else if (status === "confirmed") {
    control = (
      <div className="space-y-2">
        <div className={`${base} bg-[#06D6A0] text-white`}>You&rsquo;re in 🎉</div>
        <Link href={`/vibes/${vibeId}/chat`} className={`${base} block bg-flockie-blue text-white`}>
          Open Vibing Chat
        </Link>
        <button onClick={leave} disabled={busy} className="w-full py-2 text-center text-sm font-bold text-muted">
          Leave this Vibe
        </button>
      </div>
    );
  } else if (status === "invited") {
    control = (
      <div className="space-y-2">
        {invitationExpiresAt && (
          <p className="text-center text-sm font-bold text-flockie-orange">
            ⏳ {timeLeft()} to confirm
          </p>
        )}
        <button onClick={confirm} disabled={busy} className={`${base} bg-flockie-orange text-white shadow-[0_4px_0_0_#E0512C]`}>
          Confirm spot
        </button>
        <button onClick={decline} disabled={busy} className={`${base} bg-white`}>
          Decline
        </button>
      </div>
    );
  } else if (status === "ghosted") {
    control = (
      <div className={`${base} bg-cream text-muted`}>
        This invitation expired.
      </div>
    );
  } else if (status === "declined") {
    control = (
      <div className={`${base} bg-cream text-muted`}>
        You passed on this one.
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
      {message && (
        <p className="mt-2 text-center text-sm font-bold text-red-700">{message}</p>
      )}

      {gate && (
        <ActivityVibeForm
          userId={userId}
          onClose={() => setGate(false)}
          onDone={() => {
            setGate(false);
            setHasActivities(true);
            doInsert();
          }}
        />
      )}
    </>
  );
}
