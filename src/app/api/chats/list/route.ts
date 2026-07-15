import { NextResponse } from "next/server";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getChatList } from "@/lib/chat-list-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Unified Chats feed for the client rail/list + the nav unread badge.
// Returns { rows, unreadTotal }.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [t, locale] = await Promise.all([getTranslations("buddies"), getLocale()]);
  const payload = await getChatList(supabase, user.id, locale, {
    you: (message: string) => t("list.youPrefix", { message }),
    tripMatch: t("list.tripMatch"),
  });

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
