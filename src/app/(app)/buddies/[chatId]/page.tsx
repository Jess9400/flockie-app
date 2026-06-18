import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import BuddyChatRoom from "@/components/BuddyChatRoom";

const OPENER =
  "I was thinking of going on this trip — you look just like the travel buddy I'm looking for. Let's go?";

export default async function BuddyChatPage({
  params,
}: {
  params: { chatId: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS ensures only members can read this chat
  const { data: chat } = await supabase
    .from("buddy_chats")
    .select("id, match_id")
    .eq("id", params.chatId)
    .maybeSingle();
  if (!chat) notFound();

  const { data: match } = await supabase
    .from("buddy_matches")
    .select("user_a, user_b")
    .eq("id", chat.match_id)
    .maybeSingle();

  const otherId = match?.user_a === user!.id ? match?.user_b : match?.user_a;
  const { data: other } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", otherId!)
    .maybeSingle();

  const { data: messages } = await supabase
    .from("buddy_messages")
    .select("id, sender_id, content, created_at")
    .eq("chat_id", params.chatId)
    .order("created_at", { ascending: true })
    .limit(200);

  const otherName = other?.display_name || "your match";

  return (
    <main className="px-5 pt-6">
      <Link href="/chats" className="mb-3 flex w-fit items-center gap-1 text-sm font-bold text-muted">
        <ChevronLeft size={16} /> Chats
      </Link>
      <h1 className="text-xl font-black">{otherName}</h1>
      <BuddyChatRoom
        chatId={params.chatId}
        currentUserId={user!.id}
        otherName={otherName}
        initialMessages={messages ?? []}
        opener={OPENER}
      />
    </main>
  );
}
