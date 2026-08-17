"use client";

import { useState } from "react";
import { Check, UserRoundPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export default function ClubMembershipRequest({
  clubId,
  status,
}: {
  clubId: string;
  status: string | null;
}) {
  const supabase = createClient();
  const t = useTranslations("clubs.membership");
  const [requestStatus, setRequestStatus] = useState(status);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (requestStatus === "requested") {
    return (
      <section className="mt-5 rounded-3xl border border-flockie-blue/30 bg-flockie-blue/10 p-5 sm:p-6">
        <h2 className="text-lg font-black text-ink">{t("requestedTitle")}</h2>
        <p className="mt-1 text-sm font-medium leading-relaxed text-muted">{t("requestedBody")}</p>
      </section>
    );
  }
  if (requestStatus === "declined") {
    return (
      <section className="mt-5 rounded-3xl border border-ink/15 bg-cream p-5 sm:p-6">
        <h2 className="text-lg font-black text-ink">{t("declinedTitle")}</h2>
        <p className="mt-1 text-sm font-medium leading-relaxed text-muted">{t("declinedBody")}</p>
      </section>
    );
  }

  async function requestMembership() {
    if (message.trim().length < 20) {
      setError(t("introTooShort"));
      return;
    }
    setError(null);
    setSaving(true);
    const { error: rpcError } = await supabase.rpc("request_club_membership", {
      p_club: clubId,
      p_message: message.trim(),
    });
    setSaving(false);
    if (rpcError) {
      setError(rpcError.message || t("requestError"));
      return;
    }
    setRequestStatus("requested");
  }

  return (
    <section className="mt-5 rounded-3xl border border-flockie-blue/30 bg-flockie-blue/10 p-5 sm:p-6">
      <div className="flex gap-3">
        <UserRoundPlus className="mt-0.5 shrink-0 text-flockie-coral" size={23} />
        <div>
          <h2 className="text-lg font-black text-ink">{t("requestTitle")}</h2>
          <p className="mt-1 text-sm font-medium leading-relaxed text-muted">{t("requestBody")}</p>
        </div>
      </div>
      <label className="mt-4 block text-sm font-bold text-ink">
        {t("introLabel")}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={600}
          rows={4}
          placeholder={t("introPlaceholder")}
          className="mt-1 w-full resize-y rounded-2xl border border-ink/25 bg-white px-3 py-2 text-sm font-medium outline-none"
        />
      </label>
      <button
        type="button"
        disabled={saving}
        onClick={requestMembership}
        className="mt-5 w-full rounded-full bg-flockie-coral px-5 py-3 text-sm font-extrabold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:opacity-60 sm:w-auto"
      >
        {saving ? t("requesting") : t("request")}
      </button>
      {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
    </section>
  );
}
