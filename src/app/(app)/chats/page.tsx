import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ChatRow from "@/components/ChatRow";
import ChatEmptyArt from "@/components/ChatEmptyArt";
import { formatChatTime, formatVibeShort } from "@/lib/chat";

type BuddySummary = { chat_id: string; name: string | null; photo: string | null; unread: number };
type VibeSummary = {
  vibe_id: string;
  chat_id: string;
  title: string;
  photo: string | null;
  starts_at: string;
  unread: number;
};
type LastMsg = { sender_id: string; content: string; created_at: string };

type Row = {
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
};

async function latestPerChat(
  supabase: Awaited<ReturnType<typeof createClient>>,
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

function preview(last: LastMsg | undefined, meId: string, fallback: string): string {
  if (!last) return fallback;
  const body = last.content.replace(/\s+/g, " ").trim();
  return last.sender_id === meId ? `You: ${body}` : body;
}

function renderRow(r: Row) {
  return (
    <ChatRow
      key={r.id}
      href={r.href}
      photo={r.photo}
      title={r.title}
      subtitle={r.subtitle}
      time={r.time}
      unread={r.unread}
      fallback={r.fallback}
      fallbackTone={r.fallbackTone}
    />
  );
}

function EmptyState({
  variant,
  title,
  body,
  cta,
  href,
}: {
  variant: "buddy" | "vibe";
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-navy bg-[#FCF9F4] p-6 text-center">
      <ChatEmptyArt variant={variant} />
      <p className="mt-3 font-fredoka text-base font-semibold text-navy">{title}</p>
      <p className="mt-1 font-nunito text-sm font-normal text-navy/60">{body}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1 rounded-full border-2 border-navy bg-flockie-blue px-5 py-2 font-fredoka text-sm font-semibold text-white"
      >
        {cta} <ArrowRight size={15} />
      </Link>
    </div>
  );
}

export default async function ChatsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meId = user!.id;

  const { data: buddies } = await supabase.rpc("buddy_chat_summaries");
  const { data: vibes } = await supabase.rpc("vibe_chat_summaries");
  const buddyList = (buddies ?? []) as BuddySummary[];
  const vibeList = (vibes ?? []) as VibeSummary[];

  // Flock group chats I've joined (as an approved member) — append if not present.
  const { data: flockChats } = await supabase.rpc("my_flock_chats");
  (flockChats ?? []).forEach((fc: { chat_id: string; name: string | null; photo: string | null }) => {
    if (!buddyList.some((b) => b.chat_id === fc.chat_id)) {
      buddyList.push({ chat_id: fc.chat_id, name: fc.name, photo: fc.photo, unread: 0 });
    }
  });

  const buddyLast = await latestPerChat(
    supabase,
    "buddy_messages",
    buddyList.map((b) => b.chat_id)
  );
  const vibeLast = await latestPerChat(
    supabase,
    "vibing_messages",
    vibeList.map((v) => v.chat_id)
  );

  // Cities for the no-message context line on Vibe rows.
  const cities: Record<string, string> = {};
  if (vibeList.length) {
    const { data: vc } = await supabase
      .from("vibes")
      .select("id, city")
      .in("id", vibeList.map((v) => v.vibe_id));
    vc?.forEach((r) => (cities[r.id] = r.city));
  }

  const buddyRows: Row[] = buddyList.map((b) => {
    const last = buddyLast[b.chat_id];
    const name = b.name || "Flockie";
    return {
      id: b.chat_id,
      href: `/buddies/${b.chat_id}`,
      photo: b.photo,
      title: name,
      subtitle: preview(last, meId, "Trip match"),
      time: last ? formatChatTime(last.created_at) : "",
      unread: b.unread,
      fallback: name[0]?.toUpperCase() ?? "F",
      fallbackTone: "blue",
      sortKey: last ? new Date(last.created_at).getTime() : 0,
    };
  });

  const vibeRows: Row[] = vibeList.map((v) => {
    const last = vibeLast[v.chat_id];
    const ctx = [formatVibeShort(v.starts_at), cities[v.vibe_id]].filter(Boolean).join(" · ");
    return {
      id: v.chat_id,
      href: `/vibes/${v.vibe_id}/chat`,
      photo: v.photo,
      title: v.title,
      subtitle: preview(last, meId, ctx),
      time: last ? formatChatTime(last.created_at) : "",
      unread: v.unread,
      fallback: v.title[0]?.toUpperCase() ?? "🎟️",
      fallbackTone: "cream",
      sortKey: last ? new Date(last.created_at).getTime() : new Date(v.starts_at).getTime(),
    };
  });

  // Unread float to top, then most recent first.
  const sortRows = (rows: Row[]) =>
    rows.sort((a, b) => {
      const ua = a.unread > 0 ? 1 : 0;
      const ub = b.unread > 0 ? 1 : 0;
      if (ua !== ub) return ub - ua;
      return b.sortKey - a.sortKey;
    });

  sortRows(buddyRows);
  sortRows(vibeRows);

  // One inbox, two tabs: Travel (1:1 buddy chats) and Events (group Vibe chats).
  const tab = searchParams.tab === "events" ? "events" : "travel";
  const travelUnread = buddyRows.filter((r) => r.unread > 0).length;
  const eventsUnread = vibeRows.filter((r) => r.unread > 0).length;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-12 pt-6 font-nunito">
      <h1 className="font-fredoka text-3xl font-bold text-navy">Chats</h1>
      <p className="mt-1 font-nunito text-base font-normal text-navy/70">
        Your conversations, all in one place.
      </p>

      <div className="mt-5 inline-flex gap-1 rounded-full border-2 border-ink bg-white p-1 text-sm font-bold">
        <TabLink href="/chats?tab=travel" active={tab === "travel"} label="Travel" count={travelUnread} />
        <TabLink href="/chats?tab=events" active={tab === "events"} label="Events" count={eventsUnread} />
      </div>

      {tab === "travel" ? (
        <section className="mt-6">
          <p className="font-nunito text-sm font-normal text-navy/60">
            1:1 chats with your trip &amp; activity buddies
          </p>
          <div className="mt-3 space-y-3">
            {buddyRows.length === 0 ? (
              <EmptyState
                variant="buddy"
                title="No buddy chats yet"
                body="When you match 1:1 for a trip or activity, your chat will appear here."
                cta="Find a Buddy"
                href="/match"
              />
            ) : (
              buddyRows.map(renderRow)
            )}
          </div>
        </section>
      ) : (
        <section className="mt-6">
          <p className="font-nunito text-sm font-normal text-navy/60">
            Group chats from Vibes you joined
          </p>
          <div className="mt-3 space-y-3">
            {vibeRows.length === 0 ? (
              <EmptyState
                variant="vibe"
                title="No Vibe chats yet"
                body="Join a Vibe to start chatting with vibe-matched people."
                cta="Browse Vibes"
                href="/vibes"
              />
            ) : (
              vibeRows.map(renderRow)
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function TabLink({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 transition-colors ${active ? "bg-ink text-white" : "text-ink hover:bg-navy/5"}`}
    >
      {label}
      {count > 0 && (
        <span
          className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-extrabold ${active ? "bg-white text-ink" : "bg-flockie-coral text-white"}`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
