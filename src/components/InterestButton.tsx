"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useEsc } from "@/lib/use-esc";
import ActivityVibeForm from "@/components/ActivityVibeForm";
import { useConfirm } from "@/components/ui/feedback";
import type { InterestStatus } from "@/lib/vibes";

type Props = {
  vibeId: string;
  userId: string;
  activitiesDone: boolean;
  initialStatus: InterestStatus | null;
  invitationExpiresAt?: string | null;
  cancelled?: boolean;
  ended?: boolean;
  autoInterest?: boolean;
  requestMode?: boolean;
  hostCode?: string | null;
  initialNotForMe?: boolean;
  vibeFormDone?: boolean;
};

export default function InterestButton({
  vibeId,
  userId,
  activitiesDone,
  initialStatus,
  invitationExpiresAt,
  cancelled,
  ended,
  autoInterest,
  requestMode,
  hostCode,
  initialNotForMe = false,
  vibeFormDone,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const askConfirm = useConfirm();
  const t = useTranslations("vibes");
  const INELIGIBLE_MESSAGE = t("interest.ineligible");
  const [status, setStatus] = useState<InterestStatus | null>(initialStatus);
  const [hasActivities, setHasActivities] = useState(activitiesDone);
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState(false);
  const [gateFor, setGateFor] = useState<"interest" | "request">("interest");
  const [showCode, setShowCode] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [popup, setPopup] = useState<null | "interested" | "confirmed">(null);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState<string | null>(null);
  const [notForMe, setNotForMe] = useState(initialNotForMe);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEsc(() => setPopup(null), !!popup);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  function timeLeft(): string {
    if (!invitationExpiresAt) return "";
    const ms = +new Date(invitationExpiresAt) - now;
    if (ms <= 0) return t("interest.timeExpiring");
    const h = Math.floor(ms / 3.6e6);
    const m = Math.floor((ms % 3.6e6) / 6e4);
    return t("interest.timeLeft", { h, m });
  }

  async function doInsert() {
    setBusy(true);
    setMessage(null);
    // Friendly pre-check: hosts can set who a vibe is for (gender / age range).
    const { data: eligible } = await supabase.rpc("vibe_eligible", {
      p_user: userId,
      p_vibe: vibeId,
    });
    if (eligible === false) {
      setBusy(false);
      return setMessage(INELIGIBLE_MESSAGE);
    }
    await supabase.rpc("undo_vibe_not_for_me", { p_vibe: vibeId });
    const { error } = await supabase
      .from("vibe_interests")
      .insert({ vibe_id: vibeId, user_id: userId, status: "interested" });
    setBusy(false);
    if (error) {
      // The insert policy enforces eligibility too — translate a raw RLS
      // violation (pre-check skipped/raced) into the same friendly message.
      const rlsViolation =
        error.code === "42501" || /row-level security/i.test(error.message);
      return setMessage(rlsViolation ? INELIGIBLE_MESSAGE : error.message);
    }
    setNotForMe(false);
    setStatus("interested");
    setPopup("interested");
    router.refresh();
  }

  async function express() {
    setGateFor("interest");
    if (!hasActivities) {
      setGate(true);
      return;
    }
    await doInsert();
  }

  // Private link: request to join the host's direct spots (still vibe-checked).
  async function doRequest() {
    setBusy(true);
    const { error } = await supabase.rpc("request_private_vibe", { p_vibe: vibeId });
    setBusy(false);
    if (!error) {
      await supabase.rpc("undo_vibe_not_for_me", { p_vibe: vibeId });
      setNotForMe(false);
      setStatus("requested");
      router.refresh();
    } else {
      setMessage(error.message);
    }
  }

  async function requestPrivate() {
    setGateFor("request");
    if (!hasActivities) {
      setGate(true);
      return;
    }
    await doRequest();
  }

  // Host invite code → instantly confirmed into a host spot (no algo/approval).
  async function redeemCode(code: string) {
    const c = code.trim();
    if (!c) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.rpc("redeem_host_code", { p_vibe: vibeId, p_code: c });
    setBusy(false);
    if (error) return setMessage(error.message);
    await supabase.rpc("undo_vibe_not_for_me", { p_vibe: vibeId });
    setNotForMe(false);
    setStatus("confirmed");
    setPopup("confirmed");
    router.refresh();
  }

  // Deep-links: auto-open the right flow once on arrival.
  useEffect(() => {
    if (status === null && !cancelled && !ended) {
      if (hostCode) redeemCode(hostCode);
      else if (requestMode) requestPrivate();
      else if (autoInterest) express();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function untap() {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase
      .from("vibe_interests")
      .delete()
      .eq("vibe_id", vibeId)
      .eq("user_id", userId);
    setBusy(false);
    if (error) return setMessage(error.message);
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
      setPopup("confirmed");
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

  async function markNotForMe() {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.rpc("mark_vibe_not_for_me", { p_vibe: vibeId });
    setBusy(false);
    if (error) return setMessage(error.message);
    setNotForMe(true);
    router.refresh();
  }

  async function undoNotForMe() {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.rpc("undo_vibe_not_for_me", { p_vibe: vibeId });
    setBusy(false);
    if (error) return setMessage(error.message);
    setNotForMe(false);
    router.refresh();
  }

  async function appealRemoval() {
    const res = await askConfirm({
      title: t("interest.appealTitle"),
      message: t("interest.appealMessage"),
      allowFreeText: true,
      reasonRequired: true,
      freeTextPlaceholder: t("interest.appealPlaceholder"),
      confirmLabel: t("interest.sendAppeal"),
    });
    if (!res || !res.note) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.rpc("appeal_vibe_removal", {
      p_vibe: vibeId,
      p_note: res.note,
    });
    setBusy(false);
    setMessage(error ? error.message : t("interest.appealThanks"));
  }

  const base =
    "w-full rounded-full border-2 border-ink py-3.5 text-center font-bold disabled:opacity-50";

  let control: React.ReactNode;

  if (cancelled) {
    control = (
      <div className={`${base} bg-cream text-muted`}>
        {t("interest.cancelledByHost")}
      </div>
    );
  } else if (ended && status !== "confirmed") {
    control = (
      <div className={`${base} bg-cream text-muted`}>
        {t("interest.ended")}
      </div>
    );
  } else if (status === "confirmed") {
    control = (
      <div className="space-y-2">
        <div className={`${base} bg-[#06D6A0] text-white`}>{t("interest.youreIn")}</div>
        <Link href={`/vibes/${vibeId}/chat`} className={`${base} block bg-flockie-blue text-white`}>
          {t("interest.openVibingChat")}
        </Link>
      </div>
    );
  } else if (status === "invited") {
    control = (
      <div className="space-y-2">
        {invitationExpiresAt && (
          <p className="text-center text-sm font-bold text-flockie-orange">
            {t("interest.toConfirm", { time: timeLeft() })}
          </p>
        )}
        <button onClick={confirm} disabled={busy} className={`${base} bg-flockie-orange text-white shadow-[0_4px_0_0_#E0512C]`}>
          {t("interest.confirmSpot")}
        </button>
        <button onClick={decline} disabled={busy} className={`${base} bg-white`}>
          {t("interest.decline")}
        </button>
      </div>
    );
  } else if (status === "ghosted") {
    control = (
      <div className={`${base} bg-cream text-muted`}>
        {t("interest.invitationExpired")}
      </div>
    );
  } else if (status === "declined") {
    control = (
      <div className={`${base} bg-cream text-muted`}>
        {t("interest.passedOn")}
      </div>
    );
  } else if (status === "removed") {
    control = (
      <div className="space-y-2">
        <div className={`${base} bg-cream text-muted`}>
          {t("interest.removedMsg")}
        </div>
        <button onClick={appealRemoval} disabled={busy} className={`${base} bg-white`}>
          {t("interest.tellUsWhatHappened")}
        </button>
      </div>
    );
  } else if (status === "standby") {
    control = (
      <div className={`${base} bg-cream`}>
        {t("interest.standbyMsg")}
      </div>
    );
  } else if (status === "requested") {
    control = (
      <div className={`${base} bg-cream`}>
        {t("interest.requestSent")}
      </div>
    );
  } else if (status === "shortlisted") {
    control = (
      <div className={`${base} bg-cream`}>
        {t("interest.shortlistedMsg")}
      </div>
    );
  } else if (status === "interested") {
    control = (
      <button onClick={untap} disabled={busy} className={`${base} bg-cream`}>
        {t("interest.inRunningTap")}
      </button>
    );
  } else if (notForMe) {
    control = (
      <div className="space-y-2">
        <div className={`${base} bg-cream text-muted`}>
          {t("interest.hiddenFromRecs")}
        </div>
        <button onClick={undoNotForMe} disabled={busy} className={`${base} bg-white`}>
          {t("interest.undo")}
        </button>
      </div>
    );
  } else {
    control = (
      <div className="space-y-2">
        <button onClick={express} disabled={busy} className={`${base} bg-flockie-orange text-white shadow-[0_4px_0_0_#E0512C]`}>
          {t("interest.imInterested")}
        </button>
        <button onClick={markNotForMe} disabled={busy} className={`${base} bg-white text-muted`}>
          {t("interest.notForMe")}
        </button>
        {!showCode ? (
          <button
            type="button"
            onClick={() => setShowCode(true)}
            className="w-full py-1 text-center text-xs font-bold text-muted underline"
          >
            {t("interest.haveCode")}
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder={t("interest.hostCodePlaceholder")}
              className="h-11 w-full rounded-full border-2 border-ink px-4 text-sm font-bold uppercase tracking-[0.2em] outline-none"
            />
            <button
              type="button"
              onClick={() => redeemCode(codeInput)}
              disabled={busy}
              className="shrink-0 rounded-full border-2 border-ink bg-flockie-blue px-6 text-sm font-bold text-white disabled:opacity-50"
            >
              {t("interest.join")}
            </button>
          </div>
        )}
      </div>
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
            if (gateFor === "request") doRequest();
            else doInsert();
          }}
        />
      )}

      {popup && mounted &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={popup === "confirmed" ? t("interest.popupConfirmedAria") : t("interest.popupRunningAria")}
            className="w-full max-w-sm rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-[0_6px_0_0_rgba(10,37,69,1)]"
          >
            <p className="text-4xl">{popup === "confirmed" ? "🎉" : "✨"}</p>
            <h2 className="mt-2 font-fredoka text-2xl font-bold text-ink">
              {popup === "confirmed" ? t("interest.popupConfirmedTitle") : t("interest.popupRunningTitle")}
            </h2>
            <p className="mt-1 font-nunito text-sm font-medium text-muted">
              {popup === "confirmed"
                ? t("interest.popupConfirmedBody")
                : t("interest.popupRunningBody")}
            </p>

            {!vibeFormDone && (
              <div className="mt-4 rounded-2xl border-2 border-ink bg-cream p-3">
                <p className="text-sm font-bold text-ink">{t("interest.betterMatches")}</p>
                <p className="mt-0.5 text-xs font-medium text-muted">
                  {t("interest.takeVibeForm")}
                </p>
                <Link
                  href="/onboarding/vibe-check"
                  className="mt-3 block rounded-full border-2 border-ink bg-flockie-blue py-2.5 font-fredoka text-sm font-semibold text-white"
                >
                  {t("interest.completeVibeForm")}
                </Link>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2">
              {popup === "confirmed" && (
                <Link
                  href={`/vibes/${vibeId}/chat`}
                  className="block rounded-full border-2 border-ink bg-flockie-coral py-2.5 font-fredoka text-sm font-semibold text-white shadow-[0_3px_0_0_#E0512C]"
                >
                  {t("interest.openVibingChat")}
                </Link>
              )}
              <button
                type="button"
                onClick={() => setPopup(null)}
                className="rounded-full border-2 border-ink bg-white py-2.5 font-fredoka text-sm font-semibold text-ink"
              >
                {t("interest.done")}
              </button>
            </div>
          </div>
        </div>,
          document.body
        )}
    </>
  );
}
