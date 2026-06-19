"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeleteAccountButton() {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function remove() {
    if (
      !window.confirm(
        "Delete your account? This permanently removes your profile, vibe check, and matches. This can't be undone."
      )
    )
      return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setBusy(false);
      setErr(error.message);
      return;
    }
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="font-nunito text-sm font-medium text-navy underline decoration-navy/30 underline-offset-2 hover:decoration-navy disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Delete account"}
      </button>
      {err && <p className="mt-1 font-nunito text-xs font-medium text-flockie-coral">{err}</p>}
    </div>
  );
}
