"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useConfirm } from "@/components/ui/feedback";

export default function DeleteAccountButton() {
  const router = useRouter();
  const t = useTranslations("settings");
  const supabase = createClient();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Delete every object in one of the user's own storage folders. Storage RLS
  // ("users delete own media") already scopes this to `${userId}/`. Paginates so
  // heavy chat-image users are fully cleared. Throws on error so the caller can
  // abort BEFORE deleting the account (never leave the account gone + media live).
  async function purgeFolder(bucket: string, userId: string) {
    for (;;) {
      const { data, error } = await supabase.storage.from(bucket).list(userId, { limit: 100 });
      if (error) throw error;
      if (!data || data.length === 0) break;
      const paths = data.map((f) => `${userId}/${f.name}`);
      const { error: rmErr } = await supabase.storage.from(bucket).remove(paths);
      if (rmErr) throw rmErr;
      if (data.length < 100) break;
    }
  }

  async function remove() {
    if (
      !(await confirm({
        title: t("deleteAccount.confirmTitle"),
        message: t("deleteAccount.confirmMessage"),
        confirmLabel: t("deleteAccount.confirmLabel"),
        destructive: true,
      }))
    )
      return;
    setBusy(true);
    setErr(null);

    // Purge the user's photos + intro video FIRST — the DB delete_my_account
    // RPC can't reach storage, and public bucket URLs would otherwise stay live
    // forever. If this fails we stop and don't delete the account, so a retry
    // converges (no orphaned media, no half-deleted account).
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (uid) {
      try {
        await purgeFolder("avatars", uid);
        await purgeFolder("videos", uid);
      } catch (e) {
        setBusy(false);
        setErr(t("deleteAccount.mediaError") + ((e as Error)?.message ?? ""));
        return;
      }
    }

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
        {busy ? t("deleteAccount.deleting") : t("deleteAccount.button")}
      </button>
      {err && <p className="mt-1 font-nunito text-xs font-medium text-flockie-coral">{err}</p>}
    </div>
  );
}
