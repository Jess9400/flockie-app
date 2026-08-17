import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import ClubChatRoom, { type ClubMsg } from "@/components/ClubChatRoom";
import ClubChatHeader, { type ClubMember } from "@/components/ClubChatHeader";
import ClubNextGatheringStrip from "@/components/ClubNextGatheringStrip";
import WorkspacePanels from "@/components/WorkspacePanels";

// The club's persistent room. Members + host only (RLS enforces it too - the
// message query returns nothing for outsiders, and we bounce them back).
export default async function ClubChatPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const user = await getSessionUser();

  const { data: club } = await supabase
    .rpc("club_detail", { p_club: params.id })
    .maybeSingle();
  if (!club) redirect("/clubs");
  const detail = club as {
    id: string; title: string; cover_photo: string | null; city: string | null;
    cadence: string | null; is_host: boolean; membership_status: string | null;
  };
  const isMember =
    detail.is_host || ["founding", "regular"].includes(detail.membership_status ?? "");
  if (!isMember) redirect(`/clubs/${params.id}`);

  // Members + mute state for the header (migration-safe: RPC missing → empty).
  const [membersRes, { data: muteRow }] = await Promise.all([
    supabase.rpc("club_members", { p_club: params.id }),
    supabase
      .from("chat_mutes")
      .select("chat_id")
      .eq("user_id", user!.id)
      .eq("chat_id", params.id)
      .maybeSingle(),
  ]);
  const clubMembers: ClubMember[] = membersRes.error ? [] : ((membersRes.data ?? []) as ClubMember[]);
  const hostId = clubMembers.find((m) => m.role === "host")?.id ?? null;

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
        <ClubChatHeader
          clubId={params.id}
          title={detail.title}
          cover={detail.cover_photo ?? null}
          city={detail.city ?? null}
          cadence={detail.cadence ?? null}
          isHost={detail.is_host}
          hostId={hostId}
          initialMuted={!!muteRow}
          members={clubMembers}
        />
        {isMember && <ClubNextGatheringStrip clubId={params.id} meId={user!.id} />}
        {isMember && clubMembers.length > 0 && (
          <WorkspacePanels
            tripId={params.id}
            spaceKind="club"
            city={detail.city ?? ""}
            checkIn={null}
            checkOut={null}
            members={clubMembers.map((m) => ({ id: m.id, name: m.display_name ?? "Flockie", photo: m.photo }))}
            meId={user!.id}
          />
        )}
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
