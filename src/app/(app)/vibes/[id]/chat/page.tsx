import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import ChatRoom from "@/components/ChatRoom";
import VibeChatHeader, { type ChatMember } from "@/components/VibeChatHeader";

export default async function VibeChatPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const t = await getTranslations("buddies");
  const user = await getSessionUser();

  // get_or_create_chat enforces membership (host or confirmed)
  const { data: chatId, error } = await supabase.rpc("get_or_create_chat", {
    p_vibe: params.id,
  });

  if (error || !chatId) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 pt-6">
        <Link href={`/vibes/${params.id}`} className="mb-3 flex w-fit items-center gap-1 text-sm font-bold text-navy/60">
          <ChevronLeft size={16} /> {t("vibeChatPage.back")}
        </Link>
        <div className="rounded-3xl border-2 border-dashed border-navy/30 py-16 text-center font-nunito font-medium text-navy/60">
          {t("vibeChatPage.notConfirmed")}
        </div>
      </main>
    );
  }

  const { data: vibe } = await supabase
    .from("vibe_directory")
    .select("title, description, photos, starts_at, ends_at, city, host_id, status")
    .eq("id", params.id)
    .maybeSingle();

  const { data: logisticsRows } = await supabase.rpc("vibe_private_logistics", {
    p_vibe: params.id,
  });
  const logistics = logisticsRows?.[0] ?? null;

  const vibeEnded = vibe ? new Date(vibe.ends_at ?? vibe.starts_at) <= new Date() : false;

  const { data: muteRow } = await supabase
    .from("chat_mutes")
    .select("chat_id")
    .eq("user_id", user!.id)
    .eq("chat_id", chatId as string)
    .maybeSingle();

  const { data: messages } = await supabase
    .from("vibing_messages")
    .select("id, sender_id, content, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(200);

  // Confirmed members via RPC (vibe_interests is no longer broadly readable;
  // see supabase/vibe-attendees-rls.sql)
  const { data: confirmedRows } = await supabase.rpc("vibe_attendees", { p_vibe: params.id });

  const memberIds = Array.from(
    new Set(
      [vibe?.host_id, ...((confirmedRows ?? []) as { id: string }[]).map((r) => r.id)].filter(
        Boolean
      )
    )
  ) as string[];

  const profiles: Record<string, { display_name: string | null; photos: string[] | null; age: number | null; home_city: string | null }> = {};
  if (memberIds.length) {
    const { data: mp } = await supabase
      .from("public_profiles")
      .select("id, display_name, photos, age, home_city")
      .in("id", memberIds);
    mp?.forEach((m) => (profiles[m.id] = m));
  }

  // ChatRoom member map (name + photo)
  const members: Record<string, { display_name: string | null; photos: string[] | null }> = {};
  memberIds.forEach((id) => {
    members[id] = { display_name: profiles[id]?.display_name ?? null, photos: profiles[id]?.photos ?? null };
  });

  // Header member list (host first)
  const headerMembers: ChatMember[] = memberIds
    .map((id) => ({
      id,
      name: profiles[id]?.display_name || "Flockie",
      photo: profiles[id]?.photos?.[0] ?? null,
      age: profiles[id]?.age ?? null,
      city: profiles[id]?.home_city ?? null,
      isHost: id === vibe?.host_id,
    }))
    .sort((a, b) => (a.isHost === b.isHost ? 0 : a.isHost ? -1 : 1));

  const locationLabel = logistics?.location_name
    ? logistics.location_name
    : vibe?.city ?? "";
  const mapQuery =
    logistics?.location_lat != null && logistics?.location_lng != null
      ? `${logistics.location_lat},${logistics.location_lng}`
      : locationLabel;
  const mapSrc = mapQuery
    ? `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=14&output=embed`
    : null;

  return (
    <main className="h-full">
      <div className="flex h-full w-full flex-col px-5 font-nunito lg:px-8">
        <VibeChatHeader
          vibeId={params.id}
          title={vibe?.title ?? "Vibe"}
          cover={vibe?.photos?.[0] ?? null}
          startsAt={vibe?.starts_at ?? null}
          locationLabel={locationLabel}
          mapSrc={mapSrc}
          description={vibe?.description ?? null}
          bookingUrl={logistics?.activity_url ?? null}
          members={headerMembers}
          chatId={chatId as string}
          initialMuted={!!muteRow}
        />

        {vibe?.status === "cancelled" && (
          <div className="mt-3 shrink-0 rounded-2xl border-2 border-navy bg-cream p-3 text-sm font-bold text-navy/70">
            {t("vibeChatPage.cancelledNotice")}
          </div>
        )}

        <ChatRoom
          chatId={chatId as string}
          currentUserId={user!.id}
          members={members}
          initialMessages={messages ?? []}
          startsAt={vibe?.starts_at ?? null}
          bookingUrl={logistics?.activity_url ?? null}
          reviewHref={vibeEnded ? `/vibes/${params.id}/review` : null}
        />
      </div>
    </main>
  );
}
