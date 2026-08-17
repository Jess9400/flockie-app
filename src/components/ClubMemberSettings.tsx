"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import PayButton from "@/components/PayButton";

// Member-side club controls: profile visibility, report, leave. Host never
// sees this (they manage the club itself; closing it lives in their tools).
export default function ClubMemberSettings({
  clubId,
  isActiveMember,
  initialShowOnProfile,
  paidUntil,
  offerPriceCents,
  offerCurrency,
  paymentsEnabled,
}: {
  clubId: string;
  isActiveMember: boolean;
  initialShowOnProfile: boolean;
  paidUntil: string | null;
  offerPriceCents: number | null;
  offerCurrency: string;
  paymentsEnabled: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("clubs.memberSettings");
  const [showOnProfile, setShowOnProfile] = useState(initialShowOnProfile);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function toggleProfile() {
    setBusy("profile");
    setMsg(null);
    const next = !showOnProfile;
    const { error } = await supabase.rpc("set_club_profile_visibility", {
      p_club: clubId,
      p_visible: next,
    });
    setBusy(null);
    if (error) return setMsg(error.message);
    setShowOnProfile(next);
  }

  async function report() {
    setBusy("report");
    setMsg(null);
    const { error } = await supabase.rpc("report_club", {
      p_club: clubId,
      p_reason: reason,
      p_note: note.trim() || null,
    });
    setBusy(null);
    if (error) return setMsg(error.message);
    setReportOpen(false);
    setNote("");
    setMsg(t("reported"));
  }

  const paidActive = !!paidUntil && new Date(paidUntil) > new Date();
  const [paidEnded, setPaidEnded] = useState(false);

  async function endPaid() {
    if (!confirm(t("endPaidConfirm"))) return;
    setBusy("endPaid");
    setMsg(null);
    const { error } = await supabase.rpc("end_my_club_paid_tier", { p_club: clubId });
    setBusy(null);
    if (error) return setMsg(error.message);
    setPaidEnded(true);
    setMsg(t("endPaidDone"));
    router.refresh();
  }

  async function leave() {
    if (!confirm(t("leaveConfirm"))) return;
    setBusy("leave");
    setMsg(null);
    const { error } = await supabase.rpc("leave_club", { p_club: clubId });
    setBusy(null);
    if (error) return setMsg(error.message);
    router.push("/clubs");
    router.refresh();
  }

  return (
    <section className="mt-8 rounded-3xl border border-ink/10 bg-white p-5">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted">{t("title")}</h2>

      {isActiveMember && (
        <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 text-sm font-bold text-ink">
          {t("showOnProfile")}
          <input
            type="checkbox"
            checked={showOnProfile}
            onChange={toggleProfile}
            disabled={busy === "profile"}
            className="h-5 w-5 accent-flockie-orange"
          />
        </label>
      )}

      {isActiveMember && !paidActive && offerPriceCents != null && (
        <div className="mt-3 border-t border-ink/10 pt-3">
          <p className="text-sm font-bold text-ink">
            ⭐ {t("upgradeTitle", { price: (offerPriceCents / 100).toFixed(2), currency: offerCurrency })}
          </p>
          <p className="mt-0.5 text-xs font-medium text-muted">{t("upgradeHint")}</p>
          {paymentsEnabled && (
            <div className="mt-2">
              <PayButton kind="socio" clubId={clubId} months={1} />
            </div>
          )}
        </div>
      )}

      {isActiveMember && paidActive && !paidEnded && (
        <div className="mt-3 border-t border-ink/10 pt-3">
          <p className="text-sm font-bold text-ink">
            {t("paidStatus", { date: new Date(paidUntil!).toLocaleDateString() })}
          </p>
          <p className="mt-0.5 text-xs font-medium text-muted">{t("paidNoRenew")}</p>
          <button
            type="button"
            onClick={endPaid}
            disabled={busy === "endPaid"}
            className="mt-2 text-sm font-bold text-muted hover:text-ink disabled:opacity-50"
          >
            {t("endPaidNow")}
          </button>
        </div>
      )}

      <div className="mt-3 border-t border-ink/10 pt-3">
        {reportOpen ? (
          <div className="space-y-2">
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-ink/25 px-3 py-2 text-sm font-medium outline-none"
            >
              <option value="spam">{t("reasonSpam")}</option>
              <option value="inappropriate">{t("reasonInappropriate")}</option>
              <option value="safety">{t("reasonSafety")}</option>
              <option value="other">{t("reasonOther")}</option>
            </select>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder={t("reportNote")}
              className="w-full resize-y rounded-xl border border-ink/25 px-3 py-2 text-sm font-medium outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={report}
                disabled={busy === "report"}
                className="rounded-full border border-ink/15 bg-flockie-coral px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {t("reportSend")}
              </button>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="rounded-full border border-ink/15 bg-white px-4 py-2 text-xs font-bold text-ink"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="text-sm font-bold text-muted hover:text-ink"
          >
            🚩 {t("reportClub")}
          </button>
        )}
      </div>

      {isActiveMember && (
        <div className="mt-3 border-t border-ink/10 pt-3">
          <button
            type="button"
            onClick={leave}
            disabled={busy === "leave"}
            className="text-sm font-bold text-flockie-coral disabled:opacity-50"
          >
            {t("leaveClub")}
          </button>
        </div>
      )}

      {msg && <p className="mt-3 text-sm font-bold text-flockie-blue">{msg}</p>}
    </section>
  );
}
