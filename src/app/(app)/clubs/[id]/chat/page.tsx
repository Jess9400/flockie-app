import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import ClubChatRoom, { type ClubMsg } from "@/components/ClubChatRoom";

// The club's persistent room. Members + host only (RLS enforces it too — the
// message query returns nothing for outsiders, and we bounce them back).
export default async function ClubChatPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const user = await getSessionUser();
  const t = await getTranslations("clubs.chat");

  const { data: club } = await supabase
    .rpc("club_detail", { p_club: params.id })
    .maybeSingle();
  if (!club) redirect("/clubs");
  const detail = club as { id: string; title: string; is_host: boolean; membership_status: string | null };
  const isMember =
    detail.is_host || ["founding", "regular"].includes(detail.membership_status ?? "");
  if (!isMember) redirect(`/clubs/${params.id}`);

  const { data: messages } = await supabase
    .from("club_messages")
    .select("id, club_id, sender_id, content, created_at")
    .eq("club_id", params.id)
    .order("created_at", { ascending: true })
    .limit(200);

  // Sender display map (public profiles of everyone who has spoken + me).
  const senderIds = Array.from(
    new Set([...(messages ?? []).map((m) => m.sender_id).filter(Boolean), user!.id])
  ) as string[];
  const members: Record<string, { name: string; photo: string | null }> = {};
  if (senderIds.length) {
    const { data: profiles } = await supabase
      .from("public_profiles")
      .select("id, display_name, photos")
      .in("id", senderIds);
    profiles?.forEach((p) => {
      members[p.id] = { name: p.display_name ?? "Flockie", photo: p.photos?.[0] ?? null };
    });
  }

  return (
    <main className="h-full">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-5 font-nunito lg:px-8">
        <div className="shrink-0 border-b border-ink/10 pb-3 pt-4">
          <Link
            href={`/clubs/${params.id}`}
            className="inline-flex items-center gap-1 text-sm font-bold text-ink/55 hover:text-ink"
          >
            <ArrowLeft size={15} /> {detail.title}
          </Link>
          <h1 className="mt-1 text-xl font-black">{t("heading")}</h1>
        </div>
        <ClubChatRoom
          clubId={params.id}
          currentUserId={user!.id}
          initialMessages={(messages ?? []) as ClubMsg[]}
          members={members}
        />
      </div>
    </main>
  );
}
