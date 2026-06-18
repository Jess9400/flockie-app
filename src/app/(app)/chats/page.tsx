import Link from "next/link";
import Image from "next/image";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatVibeWhen } from "@/lib/vibes";

type BuddySummary = { chat_id: string; name: string | null; photo: string | null; unread: number };
type VibeSummary = {
  vibe_id: string;
  chat_id: string;
  title: string;
  photo: string | null;
  starts_at: string;
  unread: number;
};

function Unread({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-flockie-orange px-1.5 text-xs font-bold text-white">
      {n}
    </span>
  );
}

export default async function ChatsPage() {
  const supabase = await createClient();

  const { data: buddies } = await supabase.rpc("buddy_chat_summaries");
  const { data: vibes } = await supabase.rpc("vibe_chat_summaries");
  const buddyList = (buddies ?? []) as BuddySummary[];
  const vibeList = (vibes ?? []) as VibeSummary[];

  return (
    <main className="px-5 pt-6">
      <h1 className="text-2xl font-black">Chats</h1>
      <p className="mt-1 text-sm font-medium text-muted">Your conversations, by type.</p>

      {/* Travel Buddies */}
      <section className="mt-6">
        <p className="text-sm font-extrabold">Travel Buddies</p>
        <p className="text-xs font-medium text-muted">From trips and flocks</p>
        <div className="mt-3 max-h-[40vh] space-y-3 overflow-y-auto pr-1">
          {buddyList.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-ink/30 py-8 text-center text-sm font-medium text-muted">
              No travel-buddy chats yet. Match in Find a Buddy to start one.
            </div>
          ) : (
            buddyList.map((b) => {
              const name = b.name || "Flockie";
              return (
                <Link
                  key={b.chat_id}
                  href={`/buddies/${b.chat_id}`}
                  className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-white p-3 shadow-[0_3px_0_0_rgba(26,26,26,1)] transition-transform hover:-translate-y-0.5"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-flockie-blue">
                    {b.photo ? (
                      <Image src={b.photo} alt="" fill sizes="48px" className="object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-lg font-black text-white">
                        {name[0]}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold">{name}</p>
                    <p className="truncate text-xs font-medium text-muted">Buddy match</p>
                  </div>
                  <Unread n={b.unread} />
                </Link>
              );
            })
          )}
        </div>
      </section>

      {/* Vibe Buddies */}
      <section className="mt-8">
        <p className="text-sm font-extrabold">Vibe Buddies</p>
        <p className="text-xs font-medium text-muted">From Vibes and activity buddies</p>
        <div className="mt-3 max-h-[45vh] space-y-3 overflow-y-auto pr-1">
          {vibeList.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-ink/30 py-8 text-center text-sm font-medium text-muted">
              No Vibe chats yet. Host a Vibe or confirm a spot to start talking.
            </div>
          ) : (
            vibeList.map((v) => (
              <Link
                key={v.chat_id}
                href={`/vibes/${v.vibe_id}/chat`}
                className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-white p-3 shadow-[0_3px_0_0_rgba(26,26,26,1)] transition-transform hover:-translate-y-0.5"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-cream">
                  {v.photo ? (
                    <Image src={v.photo} alt="" fill sizes="48px" className="object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center">
                      <MessageCircle size={20} className="text-muted" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold">{v.title}</p>
                  <p className="truncate text-xs font-medium text-muted">
                    {formatVibeWhen(v.starts_at)}
                  </p>
                </div>
                <Unread n={v.unread} />
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
