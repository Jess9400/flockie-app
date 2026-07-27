"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, X } from "lucide-react";
import { format, isToday } from "date-fns";
import { useTranslations, useLocale } from "next-intl";
import { dfLocale } from "@/lib/date-locale";
import { createClient } from "@/lib/supabase/client";

export type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: {
    vibe_id?: string;
    trip_id?: string;
    like_from?: string;
    chat_id?: string;
    href?: string;
    count?: number;
  } | null;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
};

// One emoji per type, shown in a tinted thumbnail - the type signal, so the
// cards themselves stay calm and uniform.
const EMOJI: Record<string, string> = {
  vibe_invitation: "✉️",
  vibe_confirmed: "🎉",
  vibe_standby: "⏳",
  vibe_removed: "🎟️",
  vibe_removal_appeal: "🔄",
  vibing_message: "💬",
  vibe_recommendation: "✨",
  activity_like: "💙",
  buddy_match: "🤝",
  flock_approved: "✅",
  flock_declined: "🔄",
};
const THUMB_TINT: Record<string, string> = {
  vibe_invitation: "bg-flockie-coral/10",
  vibe_confirmed: "bg-[#06D6A0]/15",
  buddy_match: "bg-[#06D6A0]/15",
  flock_approved: "bg-[#06D6A0]/15",
  vibing_message: "bg-flockie-blue/10",
  vibe_recommendation: "bg-flockie-blue/10",
  activity_like: "bg-flockie-orange/10",
};

function fmtCountdown(ms: number): string | null {
  const totalMin = Math.floor(ms / 60000);
  if (totalMin <= 0) return null;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function InboxList({
  notifications,
  dismissedNotifications = [],
  titles = {},
  deadlines = {},
}: {
  notifications: Notif[];
  dismissedNotifications?: Notif[];
  titles?: Record<string, string>;
  deadlines?: Record<string, string>;
}) {
  const supabase = createClient();
  const t = useTranslations("inbox");
  const locale = useLocale();
  const dfLoc = dfLocale(locale);

  const [active, setActive] = useState(notifications);
  const [archive, setArchive] = useState(dismissedNotifications);
  const [showArchive, setShowArchive] = useState(false);
  const [undo, setUndo] = useState<Notif | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // now ticks so countdowns + relative times stay live and hydrate cleanly
  // (SSR renders no time; the client fills it in on mount).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  // Mark everything read when the inbox opens.
  useEffect(() => {
    const unread = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (unread.length === 0) return;
    supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", unread)
      .then(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byNewest = (a: Notif, b: Notif) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

  async function dismiss(n: Notif) {
    setActive((cur) => cur.filter((x) => x.id !== n.id));
    setArchive((cur) => [n, ...cur.filter((x) => x.id !== n.id)]);
    setUndo(n);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
    const { error } = await supabase
      .from("notifications")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", n.id);
    if (error) {
      setArchive((cur) => cur.filter((x) => x.id !== n.id));
      setActive((cur) => (cur.some((x) => x.id === n.id) ? cur : [n, ...cur].sort(byNewest)));
      setUndo(null);
    }
  }

  async function restore(n: Notif) {
    clearTimeout(undoTimer.current);
    setUndo(null);
    setArchive((cur) => cur.filter((x) => x.id !== n.id));
    setActive((cur) => (cur.some((x) => x.id === n.id) ? cur : [n, ...cur].sort(byNewest)));
    await supabase.from("notifications").update({ dismissed_at: null }).eq("id", n.id);
  }

  // Split active into Today / Earlier; float unexpired invites to the top of Today.
  const { today, earlier } = useMemo(() => {
    const isInviteLive = (n: Notif) => {
      const dl = n.data?.vibe_id ? deadlines[n.data.vibe_id] : undefined;
      return n.type === "vibe_invitation" && dl != null && new Date(dl).getTime() > Date.now();
    };
    const todayRows = active.filter((n) => isToday(new Date(n.created_at)));
    const earlierRows = active.filter((n) => !isToday(new Date(n.created_at)));
    todayRows.sort((a, b) => {
      const ia = isInviteLive(a) ? 1 : 0;
      const ib = isInviteLive(b) ? 1 : 0;
      if (ia !== ib) return ib - ia;
      return byNewest(a, b);
    });
    return { today: todayRows, earlier: earlierRows };
  }, [active, deadlines]);

  function relTime(iso: string): string {
    if (now == null) return "";
    const d = new Date(iso).getTime();
    const mins = (now - d) / 60000;
    if (mins < 1) return t("justNow");
    if (mins < 60) return `${Math.floor(mins)}m`;
    const hrs = mins / 60;
    if (hrs < 24) return `${Math.floor(hrs)}h`;
    const days = hrs / 24;
    if (days < 7) return format(new Date(d), "EEE", { locale: dfLoc });
    return format(new Date(d), "MMM d", { locale: dfLoc });
  }

  function hrefFor(n: Notif): string | null {
    const vibeId = n.data?.vibe_id;
    const tripId = n.data?.trip_id;
    if (n.data?.href) return n.data.href;
    if (n.type === "flock_approved") return n.data?.chat_id ? `/buddies/${n.data.chat_id}` : "/chats";
    if (n.type === "flock_declined") return "/flocks";
    if (n.type === "vibe_confirmed" && vibeId) return `/vibes/${vibeId}/chat`;
    if (vibeId) return `/vibes/${vibeId}`;
    if (tripId) return `/my-trips#trip-${tripId}`;
    if (n.data?.chat_id) return `/buddies/${n.data.chat_id}`;
    if (n.data?.like_from) return `/people/${n.data.like_from}`;
    return null;
  }

  function display(n: Notif): { title: string; body: string | null } {
    const vibeId = n.data?.vibe_id;
    const tripId = n.data?.trip_id;
    const resolvedTitle =
      (vibeId && titles[vibeId]) ||
      (tripId && titles[tripId]) ||
      (tripId ? t("fallbackTrip") : t("fallbackVibe"));
    const params = { title: resolvedTitle, count: n.data?.count ?? 0 };
    const titleKey = `types.${n.type}.title`;
    const bodyKey = `types.${n.type}.body`;
    return {
      title: t.has(titleKey) ? t(titleKey, params) : n.title,
      body: t.has(bodyKey) ? t(bodyKey, params) : n.body,
    };
  }

  function Card({ n, faded }: { n: Notif; faded?: boolean }) {
    const href = hrefFor(n);
    const { title, body } = display(n);
    const isInvite = n.type === "vibe_invitation";
    const deadlineIso = n.data?.vibe_id ? deadlines[n.data.vibe_id] : undefined;
    const countdown =
      isInvite && deadlineIso && now != null ? fmtCountdown(new Date(deadlineIso).getTime() - now) : null;
    const inviteAccent = isInvite && countdown != null && !faded;
    return (
      <div
        className={`relative rounded-2xl border-2 bg-white p-3 ${
          inviteAccent ? "border-flockie-coral" : "border-ink/12"
        } ${!n.read_at && !faded ? "shadow-[0_2px_10px_rgba(10,37,69,0.08)]" : ""} ${faded ? "opacity-60" : ""}`}
      >
        {href && (
          <Link href={href} aria-label={title} className="absolute inset-0 z-0 rounded-2xl" />
        )}
        <div className="pointer-events-none relative z-10 flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${
              THUMB_TINT[n.type] ?? "bg-cream"
            }`}
          >
            {EMOJI[n.type] ?? "🔔"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold leading-snug">{title}</p>
            {body && <p className="mt-0.5 text-sm font-medium text-ink/70">{body}</p>}
            {countdown && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-flockie-coral bg-flockie-coral/10 px-2 py-0.5 text-[11px] font-bold text-flockie-coral">
                ⏳ {t("confirmIn", { time: countdown })}
              </span>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {!faded ? (
              <button
                type="button"
                aria-label={t("dismiss")}
                className="pointer-events-auto -mr-0.5 -mt-0.5 rounded-full p-0.5 text-ink/40 hover:bg-cream hover:text-ink"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  dismiss(n);
                }}
              >
                <X size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="pointer-events-auto text-[11px] font-bold text-flockie-blue hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  restore(n);
                }}
              >
                {t("undo")}
              </button>
            )}
            <span className="text-[11px] font-semibold tabular-nums text-muted" suppressHydrationWarning>
              {relTime(n.created_at)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  function GroupLabel({ children }: { children: React.ReactNode }) {
    return (
      <p className="mb-2 mt-5 text-xs font-extrabold uppercase tracking-wide text-muted first:mt-0">
        {children}
      </p>
    );
  }

  if (active.length === 0 && archive.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-ink/30 py-16 text-center font-medium text-muted">
        {t("empty")}
      </div>
    );
  }

  return (
    <>
      {today.length > 0 && (
        <>
          <GroupLabel>{t("groupToday")}</GroupLabel>
          <div className="space-y-2.5">
            {today.map((n) => (
              <Card key={n.id} n={n} />
            ))}
          </div>
        </>
      )}

      {earlier.length > 0 && (
        <>
          <GroupLabel>{t("groupEarlier")}</GroupLabel>
          <div className="space-y-2.5">
            {earlier.map((n) => (
              <Card key={n.id} n={n} />
            ))}
          </div>
        </>
      )}

      {archive.length > 0 && (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowArchive((v) => !v)}
            className="flex w-full items-center gap-1 text-xs font-extrabold uppercase tracking-wide text-muted"
          >
            {t("dismissedArchive", { count: archive.length })}
            <ChevronDown size={14} className={`transition-transform ${showArchive ? "rotate-180" : ""}`} />
          </button>
          {showArchive && (
            <div className="mt-2.5 space-y-2.5">
              {archive.map((n) => (
                <Card key={n.id} n={n} faded />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Undo toast */}
      {undo && (
        <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 sm:bottom-8">
          <div className="flex items-center gap-4 rounded-full border border-ink/15 bg-ink px-4 py-2 text-sm font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
            {t("dismissedToast")}
            <button
              type="button"
              onClick={() => restore(undo)}
              className="font-extrabold text-flockie-coral hover:underline"
            >
              {t("undo")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
