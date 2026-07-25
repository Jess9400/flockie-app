"use client";

import { useState } from "react";
import { Check, Copy, Link2, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export type FounderInvite = {
  token: string;
  status: "active" | "accepted" | "revoked" | "expired";
  expires_at: string;
};

export default function FounderInvitePanel({
  clubId,
  initialInvites,
}: {
  clubId: string;
  initialInvites: FounderInvite[];
}) {
  const supabase = createClient();
  const t = useTranslations("clubs.founders");
  const [invites, setInvites] = useState(initialInvites);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function inviteUrl(token: string) {
    return `${window.location.origin}/clubs/invite/${token}`;
  }

  async function copyInvite(token: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      setCopied(token);
      window.setTimeout(() => setCopied((current) => (current === token ? null : current)), 2200);
    } catch {
      setError(t("copyFailed"));
    }
  }

  async function createInvite() {
    setError(null);
    setCreating(true);
    const { data, error: rpcError } = await supabase.rpc("create_club_founder_invite", { p_club: clubId });
    setCreating(false);
    if (rpcError || !data) {
      setError(rpcError?.message || t("inviteError"));
      return;
    }
    const token = data as string;
    setInvites((current) => [
      { token, status: "active", expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() },
      ...current,
    ]);
    await copyInvite(token);
  }

  async function revokeInvite(token: string) {
    setError(null);
    setRevoking(token);
    const { error: rpcError } = await supabase.rpc("revoke_club_founder_invite", { p_token: token });
    setRevoking(null);
    if (rpcError) {
      setError(rpcError.message || t("revokeError"));
      return;
    }
    setInvites((current) => current.map((invite) => (invite.token === token ? { ...invite, status: "revoked" } : invite)));
  }

  const visibleInvites = invites.filter((invite) => invite.status === "active" || invite.status === "accepted");

  return (
    <section className="mt-5 rounded-3xl border border-ink/15 bg-white p-5 shadow-[0_2px_10px_rgba(10,37,69,0.08)] sm:p-6">
      <div className="flex gap-3">
        <UserPlus className="mt-0.5 shrink-0 text-flockie-blue" size={23} />
        <div>
          <h2 className="text-lg font-black text-ink">{t("title")}</h2>
          <p className="mt-1 text-sm font-medium leading-relaxed text-muted">{t("body")}</p>
        </div>
      </div>

      <button
        type="button"
        disabled={creating}
        onClick={createInvite}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-flockie-coral px-5 py-3 text-sm font-extrabold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        <Link2 size={17} /> {creating ? t("creating") : t("create")}
      </button>

      {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}

      {visibleInvites.length > 0 ? (
        <div className="mt-5 space-y-2">
          {visibleInvites.map((invite) => {
            const active = invite.status === "active";
            return (
              <div key={invite.token} className="flex flex-col gap-3 rounded-2xl border border-ink/15 bg-cream p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className={`inline-flex items-center gap-1.5 text-sm font-extrabold ${active ? "text-ink" : "text-flockie-blue"}`}>
                  {active ? <Link2 size={16} /> : <Check size={16} />}
                  {active ? t("active") : t("accepted")}
                </span>
                {active && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => copyInvite(invite.token)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 border-ink/20 bg-white px-3 py-2 text-xs font-extrabold text-ink"
                    >
                      {copied === invite.token ? <Check size={15} /> : <Copy size={15} />}
                      {copied === invite.token ? t("copied") : t("copy")}
                    </button>
                    <button
                      type="button"
                      disabled={revoking === invite.token}
                      onClick={() => revokeInvite(invite.token)}
                      className="rounded-full border-2 border-red-200 bg-white px-3 py-2 text-xs font-extrabold text-red-700 disabled:opacity-60"
                    >
                      {revoking === invite.token ? t("revoking") : t("revoke")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border-2 border-dashed border-ink/15 bg-cream px-4 py-4 text-sm font-medium text-muted">{t("empty")}</p>
      )}

      <p className="mt-4 text-xs font-semibold leading-relaxed text-muted">{t("help")}</p>
    </section>
  );
}
