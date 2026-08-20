"use client";

import { useState } from "react";
import { Check, Copy, Pause, Play, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export type FounderInvite = {
  token: string;
  status: "active" | "accepted" | "revoked" | "expired" | "paused";
  expires_at: string;
};

// ONE PERMANENT invite link per club. It never expires; the only way it stops
// working is the host pausing invitations, which is reversible. The old
// "generate a new link" is gone - it silently broke every copy already shared,
// which is exactly what kept happening.
export default function FounderInvitePanel({
  clubId,
  initialInvites,
}: {
  clubId: string;
  initialInvites: FounderInvite[];
}) {
  const supabase = createClient();
  const t = useTranslations("clubs.founders");
  const live = initialInvites.find((i) => i.status !== "revoked") ?? null;
  const [token, setToken] = useState<string | null>(live?.token ?? null);
  const [paused, setPaused] = useState(live?.status === "paused");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inviteUrl = (value: string) => `${window.location.origin}/clubs/invite/${value}`;

  async function copyLink() {
    setError(null);
    setBusy(true);
    // Get-or-create: the same token every time, for the life of the club.
    const { data, error: rpcError } = await supabase.rpc("create_club_founder_invite", { p_club: clubId });
    setBusy(false);
    const value = (data as string | null) ?? token;
    if (!value) return setError(rpcError?.message || t("inviteError"));
    setToken(value);
    try {
      await navigator.clipboard.writeText(inviteUrl(value));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError(inviteUrl(value));
    }
  }

  async function togglePaused() {
    setError(null);
    setBusy(true);
    const { error: rpcError } = await supabase.rpc("set_club_invites_paused", {
      p_club: clubId,
      p_paused: !paused,
    });
    setBusy(false);
    if (rpcError) return setError(rpcError.message);
    setPaused(!paused);
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

      {token && (
        <p className="mt-3 break-all rounded-2xl bg-cream px-4 py-3 text-xs font-bold text-muted">
          {`/clubs/invite/${token}`}
        </p>
      )}

      <p className="mt-3 text-xs font-medium text-muted">{t("neverExpires")}</p>

      {paused && (
        <p className="mt-3 rounded-2xl bg-flockie-coral/10 px-4 py-3 text-sm font-bold text-ink">
          {t("pausedState")}
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={togglePaused}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-ink/20 bg-white px-4 py-2 text-xs font-bold text-ink disabled:opacity-60"
      >
        {paused ? <Play size={13} /> : <Pause size={13} />}
        {paused ? t("resumeCta") : t("pauseCta")}
      </button>

      {error && (
        <p role="alert" className="mt-4 break-all rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
