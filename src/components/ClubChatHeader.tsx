"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, MoreVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useConfirm, useToast } from "@/components/ui/feedback";

export type ClubMember = {
  id: string;
  display_name: string | null;
  photo: string | null;
  role: string;
  status: string;
};

// Club chat header: club info dropdown, members, and the settings menu
// (view club · mute · report · leave). Mirrors the buddy/vibe chat headers.
export default function ClubChatHeader({
  clubId,
  title,
  cover,
  city,
  cadence,
  isHost,
  hostId,
  initialMuted,
  members,
}: {
  clubId: string;
  title: string;
  cover: string | null;
  city: string | null;
  cadence: string | null;
  isHost: boolean;
  hostId: string | null;
  initialMuted: boolean;
  members: ClubMember[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("clubs.chatHeader");
  const confirm = useConfirm();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [muted, setMuted] = useState(initialMuted);
  const [leaving, setLeaving] = useState(false);

  async function toggleMute() {
    setMenu(false);
    if (muted) {
      await supabase.from("chat_mutes").delete().eq("chat_id", clubId);
      setMuted(false);
      toast(t("unmuted"));
    } else {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      await supabase.from("chat_mutes").insert({ user_id: u.user.id, chat_id: clubId });
      setMuted(true);
      toast(t("muted"));
    }
  }

  async function report() {
    setMenu(false);
    if (!hostId) return;
    const res = await confirm({
      title: t("reportTitle", { title }),
      message: t("reportMsg"),
      allowFreeText: true,
      freeTextPlaceholder: t("reportPlaceholder"),
      confirmLabel: t("reportCta"),
      destructive: true,
    });
    if (!res) return;
    await supabase.rpc("report_user", {
      p_target: hostId,
      p_reason: `[club ${clubId}] ${res.reason || res.note || ""}`.trim(),
    });
    toast(t("reported"));
  }

  async function leave() {
    setMenu(false);
    const res = await confirm({
      title: t("leaveTitle", { title }),
      message: t("leaveMsg"),
      confirmLabel: t("leaveCta"),
      destructive: true,
    });
    if (!res) return;
    setLeaving(true);
    const { error } = await supabase.rpc("leave_club", { p_club: clubId });
    setLeaving(false);
    if (error) {
      toast(error.message, "error");
      return;
    }
    router.push("/clubs");
    router.refresh();
  }

  return (
    <div className="shrink-0 border-b border-ink/10 pb-3 pt-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/clubs/${clubId}`}
          className="inline-flex items-center gap-1 text-sm font-bold text-ink/55 hover:text-ink"
        >
          <ArrowLeft size={15} /> {t("back")}
        </Link>
        <div className="flex items-center gap-1.5">
          {muted && (
            <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink/50">
              🔕 {t("mutedBadge")}
            </span>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              aria-label={t("menuAria")}
              className="flex h-8 w-8 items-center justify-center rounded-full text-navy hover:bg-navy/5"
            >
              <MoreVertical size={18} />
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
                <div className="absolute right-0 z-40 mt-1 w-52 rounded-2xl border border-navy/15 bg-white p-1.5 text-sm font-semibold text-navy shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
                  <Link
                    href={`/clubs/${clubId}`}
                    className="block rounded-xl px-3 py-2 hover:bg-navy/5"
                    onClick={() => setMenu(false)}
                  >
                    {t("viewClub")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      setExpanded(true);
                    }}
                    className="block w-full rounded-xl px-3 py-2 text-left hover:bg-navy/5"
                  >
                    {t("membersItem", { count: members.length })}
                  </button>
                  <button type="button" onClick={toggleMute} className="block w-full rounded-xl px-3 py-2 text-left hover:bg-navy/5">
                    {muted ? t("unmute") : t("mute")}
                  </button>
                  {!isHost && (
                    <button type="button" onClick={report} className="block w-full rounded-xl px-3 py-2 text-left hover:bg-navy/5">
                      {t("report")}
                    </button>
                  )}
                  {!isHost ? (
                    <button
                      type="button"
                      onClick={leave}
                      disabled={leaving}
                      className="block w-full rounded-xl px-3 py-2 text-left text-flockie-coral hover:bg-navy/5 disabled:opacity-50"
                    >
                      {leaving ? t("leaving") : t("leave")}
                    </button>
                  ) : (
                    <Link
                      href={`/clubs/${clubId}`}
                      className="block rounded-xl px-3 py-2 text-flockie-blue hover:bg-navy/5"
                      onClick={() => setMenu(false)}
                    >
                      {t("manageClub")}
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* club row — tap to expand info + members */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 flex w-full items-center gap-3 text-left"
      >
        {cover ? (
          <Image src={cover} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-2xl object-cover" />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cream text-xl">🔁</span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-black text-ink">{title}</span>
          <span className="block truncate text-xs font-bold text-muted">
            {[members.length ? t("membersCount", { count: members.length }) : null, cadence ? t(`cadence.${cadence}`) : null, city]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-navy transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="mt-3 max-h-[45vh] space-y-2 overflow-y-auto">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-ink/50">
            {t("membersHeading")}
          </p>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <Link
                key={m.id}
                href={`/people/${m.id}`}
                className="flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-2 py-1 text-xs font-bold text-navy"
              >
                {m.photo ? (
                  <Image src={m.photo} alt="" width={20} height={20} className="h-5 w-5 rounded-full object-cover" />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-flockie-blue text-[10px] font-bold text-white">
                    {(m.display_name ?? "?")[0]?.toUpperCase()}
                  </span>
                )}
                {m.display_name ?? "Flockie"}
                {m.role === "host" && <span className="text-flockie-coral">★</span>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
