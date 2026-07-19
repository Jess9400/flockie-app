"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import CityAutocomplete from "@/components/CityAutocomplete";
import { captureAndStoreLocation } from "@/lib/location";
import { normalizeCity } from "@/lib/cities";
import { withReturnTo } from "@/lib/redirects";
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
  hasCity?: boolean;
  directConfirm?: boolean;
  matchingRunAt?: string | null;
  matchingTimeZone?: string | null;
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
  hasCity = true,
  directConfirm = false,
  matchingRunAt,
  matchingTimeZone,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const askConfirm = useConfirm();
  const t = useTranslations("vibes");
  const locale = useLocale();
  const INELIGIBLE_MESSAGE = t("interest.ineligible");
  const [status, setStatus] = useState<InterestStatus | null>(initialStatus);
  const hasActivities = activitiesDone;
  const [busy, setBusy] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState<string | null>(null);
  const [notForMe, setNotForMe] = useState(initialNotForMe);
  const [mounted, setMounted] = useState(false);
  const [hasCityState, setHasCityState] = useState(hasCity);
  const [cityGate, setCityGate] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const pendingRef = useRef<null | (() => void)>(null);

  // Same-city ranking needs the applicant to have a city. If they don't, try the
  // geolocation popup first (captureAndStoreLocation auto-fills home_city when it's
  // empty), then fall back to a manual city picker. Returns true if a city is
  // present/captured; false if it opened the picker (whose Save re-runs `resume`).
  async function ensureCity(resume: () => void): Promise<boolean> {
    if (hasCityState) return true;
    const ok = await captureAndStoreLocation();
    if (ok) {
      setHasCityState(true);
      return true;
    }
    pendingRef.current = resume;
    setCityGate(true);
    return false;
  }

  async function saveCity() {
    const c = normalizeCity(cityInput);
    if (!c) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.from("profiles").update({ home_city: c }).eq("id", userId);
    setBusy(false);
    if (error) return setMessage(error.message);
    setHasCityState(true);
    setCityGate(false);
    const resume = pendingRef.current;
    pendingRef.current = null;
    resume?.();
  }

  useEffect(() => setMounted(true), []);

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
    if (!(await ensureCity(doInsert))) return;
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
    // express_interest decides: after matching with room open, it confirms the
    // person straight away (one tap); otherwise it records soft interest.
    const { data, error } = await supabase.rpc("express_interest", { p_vibe: vibeId });
    setBusy(false);
    if (error) {
      // Eligibility is enforced server-side too — translate the raw violation
      // (pre-check skipped/raced) into the same friendly message.
      const ineligible =
        error.code === "42501" || /row-level security|not eligible/i.test(error.message);
      return setMessage(ineligible ? INELIGIBLE_MESSAGE : error.message);
    }
    setNotForMe(false);
    const newStatus = ((data as { status?: string })?.status as InterestStatus) ?? "interested";
    setStatus(newStatus);
    router.refresh();
  }

  async function express() {
    if (!hasActivities) {
      router.push(
        withReturnTo("/onboarding/vibe-check", `/vibes/${vibeId}?interested=1`)
      );
      return;
    }
    await doInsert();
  }

  // Private link: request to join the host's direct spots (still vibe-checked).
  async function doRequest() {
    if (!(await ensureCity(doRequest))) return;
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
    if (!hasActivities) {
      router.push(
        withReturnTo("/onboarding/vibe-check", `/vibes/${vibeId}?request=1`)
      );
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
    "w-full rounded-full border border-ink/15 py-3.5 text-center font-bold disabled:opacity-50";
  const matchingTime = matchingRunAt
    ? new Intl.DateTimeFormat(locale, {
        weekday: "long",
        hour: "numeric",
        minute: "2-digit",
        timeZone: matchingTimeZone ?? undefined,
      }).format(new Date(matchingRunAt))
    : null;
  const statusPanel = (title: string, body?: string) => (
    <div className="rounded-2xl border-2 border-dashed border-ink/20 bg-cream px-4 py-3 text-left">
      <p className="text-sm font-extrabold text-ink">{title}</p>
      {body && <p className="mt-0.5 text-xs font-semibold leading-relaxed text-muted">{body}</p>}
    </div>
  );

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
        {statusPanel(t("interest.youreIn"), t("interest.confirmedBody"))}
        <Link href={`/vibes/${vibeId}/chat`} className={`${base} block bg-flockie-blue text-white`}>
          {t("interest.openVibingChat")}
        </Link>
      </div>
    );
  } else if (status === "invited") {
    control = (
      <div className="space-y-2">
        {statusPanel(
          t("interest.invitedTitle"),
          invitationExpiresAt
            ? `${t("interest.invitedBody")} ${t("interest.toConfirm", { time: timeLeft() })}`
            : t("interest.invitedBody")
        )}
        <button onClick={confirm} disabled={busy} className={`${base} bg-flockie-orange text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]`}>
          {t("interest.confirmSpot")}
        </button>
        <button onClick={decline} disabled={busy} className={`${base} bg-white`}>
          {t("interest.pass")}
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
      statusPanel(t("interest.standbyTitle"), t("interest.standbyBody"))
    );
  } else if (status === "requested") {
    control = (
      <div className={`${base} bg-cream`}>
        {t("interest.requestSent")}
      </div>
    );
  } else if (status === "shortlisted") {
    control = (
      statusPanel(t("interest.runningTitle"), t("interest.runningBody"))
    );
  } else if (status === "interested") {
    control = (
      <div className="space-y-2">
        {statusPanel(t("interest.runningTitle"), t("interest.runningBody"))}
        <button onClick={untap} disabled={busy} className={`${base} bg-white text-muted`}>
          {t("interest.withdrawInterest")}
        </button>
      </div>
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
        {directConfirm
          ? statusPanel(t("interest.fastFillTitle"), t("interest.fastFillBody"))
          : matchingTime
            ? statusPanel(t("interest.matchingScheduled", { time: matchingTime }))
            : null}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={express}
            disabled={busy}
            className="rounded-2xl border border-ink/15 bg-flockie-orange py-2.5 text-sm font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:opacity-50"
          >
            {directConfirm ? t("interest.joinNow") : t("interest.imInterested")}
          </button>
          <button
            onClick={markNotForMe}
            disabled={busy}
            className="rounded-2xl border border-ink/15 bg-white py-2.5 text-sm font-bold text-muted disabled:opacity-50"
          >
            {t("interest.notForMe")}
          </button>
        </div>
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
              className="h-11 w-full rounded-full border border-ink/25 px-4 text-sm font-bold uppercase tracking-[0.2em] outline-none"
            />
            <button
              type="button"
              onClick={() => redeemCode(codeInput)}
              disabled={busy}
              className="shrink-0 rounded-full border border-ink/15 bg-flockie-blue px-6 text-sm font-bold text-white disabled:opacity-50"
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

      {cityGate && mounted &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t("interest.cityGate.title")}
              className="w-full max-w-sm rounded-3xl border border-ink/15 bg-white p-6 shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
            >
              <h2 className="font-fredoka text-xl font-bold text-ink">{t("interest.cityGate.title")}</h2>
              <p className="mt-1 font-nunito text-sm font-medium text-muted">{t("interest.cityGate.body")}</p>
              <div className="mt-4">
                <CityAutocomplete
                  value={cityInput}
                  onChange={setCityInput}
                  placeholder={t("interest.cityGate.placeholder")}
                />
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCityGate(false);
                    pendingRef.current = null;
                  }}
                  className="flex-1 rounded-full border border-ink/15 py-2.5 text-sm font-bold"
                >
                  {t("interest.cityGate.cancel")}
                </button>
                <button
                  type="button"
                  disabled={busy || !cityInput.trim()}
                  onClick={saveCity}
                  className="flex-1 rounded-full border border-ink/15 bg-flockie-orange py-2.5 text-sm font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:opacity-50"
                >
                  {t("interest.cityGate.save")}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

    </>
  );
}
