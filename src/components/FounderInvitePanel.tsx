"use client";

import { useState } from "react";
import { Check, Copy, Link2, RefreshCw, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export type FounderInvite = {
  token: string;
  status: "active" | "accepted" | "revoked" | "expired";
  expires_at: string;
};

// ONE canonical invite link per club. Copying fetches it via the get-or-create
// RPC, which also rolls the 14-day validity forward - so the link the host
// already shared keeps working. "Generate new" (revoke + create) exists only
// for compromised links.
export default function FounderInvitePanel({
  clubId,
  initialInvites,
}: {
  clubId: string;
  initialInvites: FounderInvite[];
}) {
  const supabase = createClient();
  const t = useTranslations("clubs.founders");
  const [active, setActive] = useState<FounderInvite | null>(
    initialInvites.find((i) => i.status === "active" && new Date(i.expires_at) > new Date()) ?? null
  );
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inviteUrl = (token: string) => `${window.location.origin}/clubs/invite/${token}`;

  async function copyLink() {
    setError(null);
    setBusy(true);
    // Get-or-create: same token every time, validity rolled forward.
    const { data, error: rpcError } = await supabase.rpc("create_club_founder_invite", { p_club: clubId });
    setBusy(false);
    // Fall back to the link we already know is live rather than stranding the
    // host with an error: whatever the RPC refused, an active token in hand
    // still opens the club for whoever receives it.
    const token = (data as string | null) ?? active?.token ?? null;
    if (!token) return setError(rpcError?.message || t("inviteError"));
    setActive({ token, status: "active", expires_at: new Date(Date.now() + 14 * 864e5).toISOString() });
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError(inviteUrl(token));
    }
  }

  async function regenerate() {
    if (!active) return copyLink();
    if (!confirm(t("regenConfirm"))) return;
    setError(null);
    setBusy(true);
    const { error: revokeErr } = await supabase.rpc("revoke_club_founder_invite", { p_token: active.token });
    if (revokeErr) {
      setBusy(false);
      return setError(revokeErr.message);
    }
    setActive(null);
    setBusy(false);
    await copyLink();
  }

  return (
    <section className="mt-5 rounded-3xl border border-ink/15 bg-white p-5 shadow-[0_2px_10px_rgba(10,37,69,0.08)] sm:p-6">
      <div className="flex gap-3">
        <UserPlus className="mt-0.5 shrink-0 text-flockie-blue" size={23} />
        <div>
          <h2 className="text-lg font-black text-ink">{t("title")}</h2>
          <p className="mt-1 text-sm font-medium leading-relaxed text-muted">{t("bodyOneLink")}</p>
        </div>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={copyLink}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-flockie-coral px-5 py-3 text-sm font-extrabold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {copied ? <Check size={17} /> : <Copy size={17} />}
        {copied ? t("copied") : t("copyLink")}
      </button>

      {active && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-muted">
          <Link2 size={14} />
          <span>{t("validUntil", { date: new Date(active.expires_at).toLocaleDateString() })}</span>
          <button
            type="button"
            disabled={busy}
            onClick={regenerate}
            className="inline-flex items-center gap-1 text-xs font-bold text-red-600/80 hover:text-red-700 disabled:opacity-60"
          >
            <RefreshCw size={12} /> {t("regenerate")}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 break-all rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
