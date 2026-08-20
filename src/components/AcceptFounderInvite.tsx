"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export default function AcceptFounderInvite({
  token,
  clubId,
  clubTitle,
  nextVibeId,
  signedIn = true,
}: {
  token: string;
  clubId: string;
  clubTitle: string;
  nextVibeId?: string | null;
  // A signed-out visitor sees the club first and signs in on this button,
  // landing back here to accept - the same shape as a shared Vibe link.
  signedIn?: boolean;
}) {
  const supabase = createClient();
  const t = useTranslations("clubs.invite");
  const [saving, setSaving] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setError(null);
    setSaving(true);
    const { error: rpcError } = await supabase.rpc("accept_club_founder_invite", { p_token: token });
    setSaving(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setAccepted(true);
  }

  if (accepted) {
    return (
      <section className="mt-6 rounded-[2rem] border border-flockie-blue/30 bg-flockie-blue/10 p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-flockie-blue text-white"><Check size={25} /></span>
        <h2 className="mt-4 text-xl font-black text-ink">{t("acceptedTitle")}</h2>
        <p className="mt-2 text-sm font-medium leading-relaxed text-muted">{t("acceptedBody", { club: clubTitle })}</p>
        <div className="mt-5 flex flex-col items-center gap-3">
          {nextVibeId && (
            <Link href={`/vibes/${nextVibeId}`} className="inline-flex items-center gap-2 rounded-full bg-flockie-coral px-5 py-3 text-sm font-extrabold text-white shadow-[0_3px_0_#d84e32]">
              <Check size={16} /> {t("confirmNext")}
            </Link>
          )}
          <Link
            href={`/clubs/${clubId}?welcome=1`}
            className={
              nextVibeId
                ? "inline-flex rounded-full border border-ink/15 bg-white px-5 py-3 text-sm font-extrabold text-navy"
                : "inline-flex rounded-full bg-flockie-coral px-5 py-3 text-sm font-extrabold text-white shadow-[0_3px_0_#d84e32]"
            }
          >
            {t("viewClub")}
          </Link>
        </div>
      </section>
    );
  }

  if (!signedIn) {
    return (
      <section className="mt-6">
        <Link
          href={`/login?redirect=${encodeURIComponent(`/clubs/invite/${token}`)}`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-flockie-coral px-5 py-4 text-base font-extrabold text-white shadow-[0_4px_0_#d84e32]"
        >
          <Sparkles size={18} /> {t("accept")}
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-6">
      {error && <p role="alert" className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
      <button
        type="button"
        disabled={saving}
        onClick={accept}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-flockie-coral px-5 py-4 text-base font-extrabold text-white shadow-[0_4px_0_#d84e32] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Sparkles size={18} /> {saving ? t("accepting") : t("accept")}
      </button>
    </section>
  );
}
