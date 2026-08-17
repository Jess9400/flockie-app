// Shared builder for the unified Chats list (buddy + flock + vibe conversations
// in one stream). Used by the /api/chats/list route handler that feeds both the
// mobile list and the desktop conversation rail. Mirrors the sort/preview rules
// the old three-tab /chats page used, minus the tab split.
import type { createClient } from "@/lib/supabase/server";
import { formatChatTime, formatVibeShort } from "@/lib/chat";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type BuddySummary = {
  chat_id: string;
  name: string | null;
  photo: string | null;
  unread: number;
  kind?: string;
  // From buddy_chat_summaries: last message time, or the chat's creation time
  // when there are no messages yet (so brand-new matches sort correctly).
  last_at?: string | null;
};
type VibeSummary = {
  vibe_id: string;
  chat_id: string;
  title: string;
  photo: string | null;
  starts_at: string;
  unread: number;
};
type ClubSummary = {
  club_id: string;
  title: string;
  cover_photo: string | null;
  unread: number;
  last_at: string | null;
};
type LastMsg = { sender_id: string | null; content: string; created_at: string };

// A conversation row, shape-compatible with the client list renderer. `group`
// drives the All / Groups / Direct filter; `kind` keeps the finer type for the
// row marker (·buddy tag, thumb vs avatar).
export type ChatListRow = {
  id: string;
  href: string;
  photo: string | null;
  title: string;
  subtitle: string;
  time: string;
  unread: number;
  fallback: string;
  fallbackTone: "blue" | "cream";
  sortKey: number;
  kind: string;
  group: "group" | "direct";
};

export type ChatListPayload = { rows: ChatListRow[]; unreadTotal: number };

// Group chats (Vibe + Flock) vs 1:1 direct chats (travel/activity buddies).
function groupFor(kind: string): "group" | "direct" {
  return kind === "vibe" || kind === "flock" || kind === "club" ? "group" : "direct";
}

async function latestPerChat(
  supabase: Supabase,
  table: "vibing_messages" | "buddy_messages",
  chatIds: string[]
): Promise<Record<string, LastMsg>> {
  const out: Record<string, LastMsg> = {};
  if (chatIds.length === 0) return out;
  const { data } = await supabase
    .from(table)
    .select("chat_id, sender_id, content, created_at")
    .in("chat_id", chatIds)
    .order("created_at", { ascending: false })
    .limit(300);
  data?.forEach((m) => {
    if (!out[m.chat_id]) out[m.chat_id] = m as LastMsg;
  });
  return out;
}

function preview(
  last: LastMsg | undefined,
  meId: string,
  fallback: string,
  you: (message: string) => string
): string {
  if (!last) return fallback;
  const body = last.content.replace(/\s+/g, " ").trim();
  return last.sender_id === meId ? you(body) : body;
}

// Build the full unified list. `labels` carries the couple of i18n strings the
// helper needs so it can stay framework/locale-agnostic.
export async function getChatList(
  supabase: Supabase,
  meId: string,
  locale: string,
  labels: { you: (message: string) => string; tripMatch: string; activityMatch: string; clubChat: string }
): Promise<ChatListPayload> {
  const [{ data: buddies }, { data: vibes }, { data: flockChats }, clubsRes] = await Promise.all([
    supabase.rpc("buddy_chat_summaries"),
    supabase.rpc("vibe_chat_summaries"),
    supabase.rpc("my_flock_chats"),
    // Club rooms - migration-safe (RPC missing on prod → no club rows).
    supabase.rpc("my_club_chats"),
  ]);
  const clubList: ClubSummary[] = clubsRes.error ? [] : ((clubsRes.data ?? []) as ClubSummary[]);
  const buddyList = (buddies ?? []) as BuddySummary[];
  const vibeList = (vibes ?? []) as VibeSummary[];

  // Flock group chats I've joined - append if not already surfaced as a buddy row.
  (flockChats ?? []).forEach((fc: { chat_id: string; name: string | null; photo: string | null }) => {
    if (!buddyList.some((b) => b.chat_id === fc.chat_id)) {
      buddyList.push({ chat_id: fc.chat_id, name: fc.name, photo: fc.photo, unread: 0, kind: "flock" });
    }
  });

  // Latest club message per club (club_messages keys on club_id, not chat_id).
  const clubLastPromise: Promise<Record<string, LastMsg>> = (async () => {
    const out: Record<string, LastMsg> = {};
    if (clubList.length === 0) return out;
    const { data } = await supabase
      .from("club_messages")
      .select("club_id, sender_id, content, created_at")
      .in("club_id", clubList.map((c) => c.club_id))
      .order("created_at", { ascending: false })
      .limit(200);
    data?.forEach((m) => {
      if (!out[m.club_id]) out[m.club_id] = m as LastMsg;
    });
    return out;
  })();

  const [buddyLast, vibeLast, clubLast, { data: vibeMeta }] = await Promise.all([
    latestPerChat(supabase, "buddy_messages", buddyList.map((b) => b.chat_id)),
    latestPerChat(supabase, "vibing_messages", vibeList.map((v) => v.chat_id)),
    clubLastPromise,
    vibeList.length
      ? supabase.from("vibe_directory").select("id, city, photos, club_id").in("id", vibeList.map((v) => v.vibe_id))
      : Promise.resolve({ data: [] as { id: string; city: string; photos: string[] | null }[] }),
  ]);

  const cities: Record<string, string> = {};
  const vibeBanner: Record<string, string | null> = {};
  // Club gatherings live in the CLUB chat - their event chats never appear in
  // the list (one conversation per club, not one per gathering).
  const clubGatheringIds = new Set<string>();
  vibeMeta?.forEach((r) => {
    cities[r.id] = r.city;
    vibeBanner[r.id] = (r.photos as string[] | null)?.[0] ?? null;
    if ((r as { club_id?: string | null }).club_id) clubGatheringIds.add(r.id);
  });

  const buddyRows: ChatListRow[] = buddyList.map((b) => {
    const last = buddyLast[b.chat_id];
    const name = b.name || "Flockie";
    const kind = b.kind ?? "travel_buddy";
    // No-message fallback text depends on the buddy kind (an activity match
    // must not read as a "Trip match").
    const noMsgFallback = kind === "activity_buddy" ? labels.activityMatch : labels.tripMatch;
    // Sort by last message, else the chat's creation time (last_at from the
    // RPC) so a brand-new match lands at the top, not the bottom.
    const activityAt = last
      ? new Date(last.created_at).getTime()
      : b.last_at
        ? new Date(b.last_at).getTime()
        : 0;
    return {
      id: b.chat_id,
      href: `/buddies/${b.chat_id}`,
      photo: b.photo,
      title: name,
      subtitle: preview(last, meId, noMsgFallback, labels.you),
      time: last ? formatChatTime(last.created_at, locale) : "",
      unread: b.unread,
      fallback: name[0]?.toUpperCase() ?? "F",
      fallbackTone: "blue",
      sortKey: activityAt,
      kind,
      group: groupFor(kind),
    };
  });

  const vibeRows: ChatListRow[] = vibeList
    .filter((v) => !clubGatheringIds.has(v.vibe_id))
    .map((v) => {
    const last = vibeLast[v.chat_id];
    const ctx = [formatVibeShort(v.starts_at, locale), cities[v.vibe_id]].filter(Boolean).join(" · ");
    return {
      id: v.chat_id,
      href: `/vibes/${v.vibe_id}/chat`,
      photo: vibeBanner[v.vibe_id] ?? v.photo,
      title: v.title,
      subtitle: preview(last, meId, ctx, labels.you),
      time: last ? formatChatTime(last.created_at, locale) : "",
      unread: v.unread,
      fallback: v.title[0]?.toUpperCase() ?? "🎟️",
      fallbackTone: "cream",
      sortKey: last ? new Date(last.created_at).getTime() : new Date(v.starts_at).getTime(),
      kind: "vibe",
      group: "group",
    };
  });

  const clubRows: ChatListRow[] = clubList.map((c) => {
    const last = clubLast[c.club_id];
    return {
      id: `club-${c.club_id}`,
      href: `/clubs/${c.club_id}/chat`,
      photo: c.cover_photo,
      title: c.title,
      subtitle: preview(last, meId, labels.clubChat, labels.you),
      time: last ? formatChatTime(last.created_at, locale) : "",
      unread: c.unread,
      fallback: c.title[0]?.toUpperCase() ?? "C",
      fallbackTone: "cream",
      sortKey: last
        ? new Date(last.created_at).getTime()
        : c.last_at
          ? new Date(c.last_at).getTime()
          : 0,
      kind: "club",
      group: "group",
    };
  });

  // Unread float to top, then most recent first - one stream, no tabs.
  const rows = [...buddyRows, ...vibeRows, ...clubRows].sort((a, b) => {
    const ua = a.unread > 0 ? 1 : 0;
    const ub = b.unread > 0 ? 1 : 0;
    if (ua !== ub) return ub - ua;
    return b.sortKey - a.sortKey;
  });

  const unreadTotal = rows.reduce((n, r) => n + (r.unread > 0 ? r.unread : 0), 0);
  return { rows, unreadTotal };
}
