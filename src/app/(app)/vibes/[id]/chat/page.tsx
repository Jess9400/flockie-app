import Link from "next/link";
import { ChevronLeft, MapPin, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ChatRoom from "@/components/ChatRoom";
import { formatVibeWhen } from "@/lib/vibes";

export default async function VibeChatPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // get_or_create_chat enforces membership (host or confirmed)
  const { data: chatId, error } = await supabase.rpc("get_or_create_chat", {
    p_vibe: params.id,
  });

  if (error || !chatId) {
    return (
      <main className="px-5 pt-6">
        <Link href={`/vibes/${params.id}`} className="mb-3 flex w-fit items-center gap-1 text-sm font-bold text-muted">
          <ChevronLeft size={16} /> Back
        </Link>
        <div className="rounded-3xl border-2 border-dashed border-ink/30 py-16 text-center font-medium text-muted">
          The Vibing Chat opens once you&rsquo;re confirmed for this Vibe.
        </div>
      </main>
    );
  }

  const { data: vibe } = await supabase
    .from("vibes")
    .select("title, starts_at, location_name, city, host_id")
    .eq("id", params.id)
    .maybeSingle();

  const { data: messages } = await supabase
    .from("vibing_messages")
    .select("id, sender_id, content, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(200);

  // members = host + confirmed attendees
  const { data: confirmedRows } = await supabase
    .from("vibe_interests")
    .select("user_id")
    .eq("vibe_id", params.id)
    .eq("status", "confirmed");

  const memberIds = Array.from(
    new Set([vibe?.host_id, ...(confirmedRows ?? []).map((r) => r.user_id)].filter(Boolean))
  ) as string[];

  const members: Record<string, { display_name: string | null; photos: string[] | null }> = {};
  if (memberIds.length) {
    const { data: mp } = await supabase
      .from("profiles")
      .select("id, display_name, photos")
      .in("id", memberIds);
    mp?.forEach((m) => (members[m.id] = { display_name: m.display_name, photos: m.photos }));
  }

  const locationQuery = vibe?.location_name
    ? `${vibe.location_name}, ${vibe.city}`
    : vibe?.city ?? "";
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(
    locationQuery
  )}&z=14&output=embed`;

  return (
    <main className="px-5 pt-6">
      <Link
        href={`/vibes/${params.id}`}
        className="mb-3 flex w-fit items-center gap-1 text-sm font-bold text-muted"
      >
        <ChevronLeft size={16} /> Back to Vibe
      </Link>

      {/* pinned info + map */}
      <div className="overflow-hidden rounded-3xl border-2 border-ink bg-white">
        <div className="p-4">
          <p className="text-lg font-extrabold">{vibe?.title}</p>
          {vibe?.starts_at && (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-ink">
              <CalendarClock size={15} className="text-flockie-orange" />
              {formatVibeWhen(vibe.starts_at)}
            </p>
          )}
          <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-ink">
            <MapPin size={15} className="text-flockie-orange" />
            {locationQuery || "Location TBD"}
          </p>
        </div>
        {locationQuery && (
          <iframe
            title="Event location"
            src={mapSrc}
            loading="lazy"
            className="h-44 w-full border-t-2 border-ink"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </div>

      <ChatRoom
        chatId={chatId as string}
        currentUserId={user!.id}
        members={members}
        initialMessages={messages ?? []}
      />
    </main>
  );
}
