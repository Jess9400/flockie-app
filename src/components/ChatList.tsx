"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import type { ChatListRow, ChatListPayload } from "@/lib/chat-list-data";

type Filter = "all" | "groups" | "direct";

// Unified conversation list. Rendered two ways:
//  - variant="page": mobile full-screen list at /chats (hidden on desktop)
//  - variant="rail": persistent left column on desktop chat routes
// Both fetch the same /api/chats/list feed and refresh on new messages + on
// navigation (so unread clears after a room marks itself read).
export default function ChatList({ variant = "page" }: { variant?: "page" | "rail" }) {
  const t = useTranslations("buddies");
  const pathname = usePathname();
  // Unique per mounted instance. The browser Supabase client is a singleton, so
  // two ChatLists on the same route (mobile page + desktop rail) would otherwise
  // both grab the same-named channel — and calling .on() on an already-
  // subscribed channel throws and crashes the page.
  const instanceId = useId();
  const [rows, setRows] = useState<ChatListRow[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/chats/list", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as ChatListPayload;
      setRows(data.rows);
    } catch {
      /* transient network — keep last good state */
    }
  }, []);

  // Refetch on mount and whenever the route changes (covers read-clearing when
  // navigating back from an open conversation).
  useEffect(() => {
    load();
  }, [load, pathname]);

  // Live refresh on any new message in either table. Server recomputes unread +
  // ordering, so we just re-pull. Low volume; fine for beta.
  useEffect(() => {
    const supabase = createClient();
    try {
      const channel = supabase
        .channel(`chat-list-feed-${instanceId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "vibing_messages" }, () => load())
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "buddy_messages" }, () => load())
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      // Realtime setup failed — fall back to fetch-on-navigation only. Never let
      // a subscription error crash the surrounding page.
      return;
    }
  }, [load, instanceId]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (filter === "groups") return rows.filter((r) => r.group === "group");
    if (filter === "direct") return rows.filter((r) => r.group === "direct");
    return rows;
  }, [rows, filter]);

  const chips: { key: Filter; label: string }[] = [
    { key: "all", label: t("list.filterAll") },
    { key: "groups", label: t("list.filterGroups") },
    { key: "direct", label: t("list.filterDirect") },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={variant === "rail" ? "px-3 pt-4" : "px-1"}>
        <h1 className="font-fredoka text-2xl font-bold text-navy lg:text-xl">{t("list.title")}</h1>
        <div className="mt-3 flex gap-1.5">
          {chips.map((c) => {
            const active = filter === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setFilter(c.key)}
                className={`rounded-full px-3 py-1 font-nunito text-xs font-extrabold transition-colors ${
                  active ? "bg-flockie-coral text-white" : "bg-cream text-navy/60 hover:bg-navy/5"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={`mt-3 min-h-0 flex-1 space-y-2 ${
          variant === "rail" ? "overflow-y-auto px-3 pb-4" : "px-1"
        }`}
      >
        {rows === null ? (
          <ListSkeleton />
        ) : filtered.length === 0 ? (
          <p className="px-2 py-8 text-center font-nunito text-sm font-medium text-navy/50">
            {t("list.filterEmpty")}
          </p>
        ) : (
          filtered.map((r) => (
            <ConversationRow key={r.id} row={r} active={pathname === r.href} buddyTag={t("list.buddyTag")} />
          ))
        )}
      </div>
    </div>
  );
}

function ConversationRow({
  row,
  active,
  buddyTag,
}: {
  row: ChatListRow;
  active: boolean;
  buddyTag: string;
}) {
  const isGroup = row.group === "group";
  const isBuddy = row.kind === "travel_buddy" || row.kind === "activity_buddy";
  return (
    <Link
      href={row.href}
      className={`flex items-center gap-3 rounded-2xl border-2 px-2.5 py-2.5 transition-all ${
        active
          ? "border-flockie-blue bg-flockie-blue/10"
          : "border-navy bg-[#FCF9F4] hover:shadow-[0_3px_10px_rgba(10,37,69,0.1)]"
      } ${row.unread === 0 ? "" : ""}`}
    >
      {/* Thumb: square-ish for groups, round for people. */}
      <div
        className={`relative h-12 w-12 shrink-0 overflow-hidden ${
          isGroup ? "rounded-xl" : "rounded-full"
        }`}
      >
        {row.photo ? (
          <Image src={row.photo} alt="" fill sizes="48px" className="object-cover" />
        ) : (
          <span
            className={`flex h-full w-full items-center justify-center text-lg font-bold ${
              row.fallbackTone === "blue" ? "bg-flockie-blue text-white" : "bg-cream text-navy"
            }`}
          >
            {row.fallback}
          </span>
        )}
      </div>

      {/* Middle */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-fredoka text-[15px] font-semibold text-navy">
          {row.title}
          {!isGroup && isBuddy && (
            <span className="font-nunito text-xs font-medium text-navy/40"> · {buddyTag}</span>
          )}
        </p>
        <p className="truncate font-nunito text-[13px] font-normal text-navy/60">{row.subtitle}</p>
      </div>

      {/* Right */}
      <div className="flex shrink-0 flex-col items-end gap-1.5 pl-1">
        <span className="font-nunito text-[11px] font-semibold tabular-nums text-navy/50">{row.time}</span>
        {row.unread > 0 &&
          (row.unread === 1 ? (
            <span className="h-2.5 w-2.5 rounded-full bg-flockie-coral" />
          ) : (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-flockie-coral px-1.5 font-nunito text-[11px] font-bold text-white">
              {row.unread > 99 ? "99+" : row.unread}
            </span>
          ))}
      </div>
    </Link>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border-2 border-navy/10 px-2.5 py-2.5">
          <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-navy/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-navy/10" />
            <div className="h-3 w-1/2 animate-pulse rounded-full bg-navy/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
