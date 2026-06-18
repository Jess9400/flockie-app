"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function NotificationsToggle({
  userId,
  initial,
}: {
  userId: string;
  initial: boolean;
}) {
  const supabase = createClient();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next);
    setBusy(true);
    await supabase.from("profiles").update({ notifications_enabled: next }).eq("id", userId);
    setBusy(false);
  }

  return (
    <div className="flex items-center justify-between rounded-2xl border-2 border-ink bg-white p-4">
      <div>
        <p className="text-sm font-extrabold">Notifications</p>
        <p className="text-xs font-medium text-muted">
          Invitations, confirmations, and updates.
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={busy}
        aria-pressed={on}
        className={`relative h-7 w-12 shrink-0 rounded-full border-2 border-ink transition-colors ${
          on ? "bg-flockie-orange" : "bg-cream"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white border-2 border-ink transition-all ${
            on ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
