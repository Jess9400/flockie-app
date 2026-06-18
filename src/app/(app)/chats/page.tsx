import Link from "next/link";
import Image from "next/image";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatVibeWhen } from "@/lib/vibes";

type ChatVibe = {
  id: string;
  title: string;
  starts_at: string;
  photos: string[] | null;
  city: string;
  location_name: string | null;
  role: "host" | "going";
};

export default async function ChatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: hosted } = await supabase
    .from("vibes")
    .select("id, title, starts_at, photos, city, location_name")
    .eq("host_id", user!.id);

  const { data: confirmedRows } = await supabase
    .from("vibe_interests")
    .select("vibe_id")
    .eq("user_id", user!.id)
    .eq("status", "confirmed");

  const confirmedIds = (confirmedRows ?? []).map((r) => r.vibe_id);
  let confirmedVibes: Omit<ChatVibe, "role">[] = [];
  if (confirmedIds.length) {
    const { data } = await supabase
      .from("vibes")
      .select("id, title, starts_at, photos, city, location_name")
      .in("id", confirmedIds);
    confirmedVibes = data ?? [];
  }

  // Buddy (1:1 match) chats
  const { data: bchats } = await supabase.from("buddy_chats").select("id, match_id");
  let buddies: { chatId: string; name: string }[] = [];
  if (bchats && bchats.length) {
    const matchIds = bchats.map((b) => b.match_id);
    const { data: ms } = await supabase
      .from("buddy_matches")
      .select("id, user_a, user_b")
      .in("id", matchIds);
    const otherByMatch: Record<string, string> = {};
    ms?.forEach((m) => {
      otherByMatch[m.id] = m.user_a === user!.id ? m.user_b : m.user_a;
    });
    const otherIds = Object.values(otherByMatch);
    const nameById: Record<string, string> = {};
    if (otherIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", otherIds);
      profs?.forEach((p) => (nameById[p.id] = p.display_name ?? "Flockie"));
    }
    buddies = bchats.map((b) => ({
      chatId: b.id,
      name: nameById[otherByMatch[b.match_id]] ?? "Match",
    }));
  }

  const map = new Map<string, ChatVibe>();
  (hosted ?? []).forEach((v) => map.set(v.id, { ...v, role: "host" }));
  confirmedVibes.forEach((v) => {
    if (!map.has(v.id)) map.set(v.id, { ...v, role: "going" });
  });
  const list = Array.from(map.values()).sort(
    (a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)
  );

  return (
    <main className="px-5 pt-6">
      <h1 className="text-2xl font-black">Chats</h1>
      <p className="mt-1 text-sm font-medium text-muted">
        Group chats for the Vibes you host or are going to.
      </p>

      {buddies.length > 0 && (
        <div className="mt-6 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Buddy matches</p>
          {buddies.map((b) => (
            <Link
              key={b.chatId}
              href={`/buddies/${b.chatId}`}
              className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-white p-3 shadow-[0_3px_0_0_rgba(26,26,26,1)] transition-transform hover:-translate-y-0.5"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-flockie-blue text-lg font-black text-white">
                {b.name[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold">{b.name}</p>
                <p className="truncate text-xs font-medium text-muted">Buddy match · say hi</p>
              </div>
              <span className="shrink-0 rounded-full bg-flockie-orange px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                Buddy
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {list.length === 0 && buddies.length === 0 && (
          <div className="rounded-3xl border-2 border-dashed border-ink/30 py-16 text-center font-medium text-muted">
            No chats yet. Host a Vibe or confirm a spot to start talking.
          </div>
        )}
        {list.map((v) => (
          <Link
            key={v.id}
            href={`/vibes/${v.id}/chat`}
            className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-white p-3 shadow-[0_3px_0_0_rgba(26,26,26,1)] transition-transform hover:-translate-y-0.5"
          >
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-cream">
              {v.photos?.[0] ? (
                <Image src={v.photos[0]} alt="" fill sizes="48px" className="object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center">
                  <MessageCircle size={20} className="text-muted" />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-extrabold">{v.title}</p>
              <p className="truncate text-xs font-medium text-muted">
                {formatVibeWhen(v.starts_at)} · {v.location_name || v.city}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                v.role === "host"
                  ? "bg-flockie-orange text-white"
                  : "bg-flockie-blue text-white"
              }`}
            >
              {v.role === "host" ? "Host" : "Going"}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
