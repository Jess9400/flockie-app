import { notFound } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import BuddyChatRoom from "@/components/BuddyChatRoom";
import BuddyChatHeader from "@/components/BuddyChatHeader";
import FlockJoinRequests, { type JoinReq } from "@/components/FlockJoinRequests";
import { type PeekData } from "@/components/ProfilePeek";

export default async function BuddyChatPage({
  params,
}: {
  params: { chatId: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const otherId = (match?.user_a === user!.id ? match?.user_b : match?.user_a) as string;

  // Extended match context — columns added by buddy-match-context.sql. Queried
  // separately so the page still works before that migration is applied.
  const { data: matchExt } = await supabase
    .from("buddy_matches")
    .select("trip_a, trip_b, score")
    .eq("id", chat.match_id)
    .maybeSingle();
  const otherTripId = (otherId === match?.user_a ? matchExt?.trip_a : matchExt?.trip_b) as string | null;

  // If this match was converted into a Flock, surface its pending join requests
  // so both buddies can approve together.
  const flockTripIds = [matchExt?.trip_a, matchExt?.trip_b].filter(Boolean) as string[];
  let flockTripId: string | null = null;
  let flockHostId: string | null = null;
  let flockCoHost: string | null = null;
  let flockTitle = "";
  let flockStart: string | null = null;
  let flockEnd: string | null = null;
  let flockReqs: JoinReq[] = [];
  const chatMembers: Record<string, { name: string; photo: string | null }> = {};
  if (flockTripIds.length) {
    // Any public trip behind this chat is a Flock — group chat for host + all
    // accepted members. (Previously required a co-host, which wrongly excluded
    // directly-created flocks and rendered them as a 1:1.)
    const { data: fls } = await supabase
      .from("trips")
      .select("id, user_id, destination, co_host_id, start_date, end_date")
      .in("id", flockTripIds)
      .eq("visibility", "public")
      .limit(1);
    const fl = fls?.[0] ?? null;
    if (fl) {
      flockTripId = fl.id;
      flockHostId = fl.user_id;
      flockCoHost = fl.co_host_id ?? null;
      flockTitle = fl.destination ?? "Flock";
      flockStart = fl.start_date ?? null;
      flockEnd = fl.end_date ?? null;
      const { data: jr } = await supabase
        .from("trip_join_requests")
        .select("user_id, status")
        .eq("trip_id", fl.id)
        .eq("status", "pending");
      const ids = (jr ?? []).map((r) => r.user_id);
      if (ids.length) {
        const { data: rp } = await supabase
          .from("public_profiles")
          .select("id, display_name, age, photos, one_liner")
          .in("id", ids);
        const map: Record<string, { display_name: string | null; age: number | null; photos: string[] | null; one_liner: string | null }> = {};
        rp?.forEach((p) => (map[p.id] = p));
        flockReqs = (jr ?? []).map((r) => ({
          userId: r.user_id,
          status: r.status,
          name: map[r.user_id]?.display_name || "Flockie",
          age: map[r.user_id]?.age ?? null,
          photo: map[r.user_id]?.photos?.[0] ?? null,
          oneLiner: map[r.user_id]?.one_liner ?? null,
        }));
      }

      // All chat participants (the two buddies + accepted members) for names.
      const { data: accp } = await supabase
        .from("trip_join_requests")
        .select("user_id")
        .eq("trip_id", fl.id)
        .eq("status", "accepted");
      const memberIds = Array.from(
        new Set([match?.user_a, match?.user_b, ...(accp ?? []).map((r) => r.user_id)].filter(Boolean))
      ) as string[];
      if (memberIds.length) {
        const { data: mp } = await supabase
          .from("public_profiles")
          .select("id, display_name, photos")
          .in("id", memberIds);
        mp?.forEach((p) => (chatMembers[p.id] = { name: p.display_name || "Flockie", photo: p.photos?.[0] ?? null }));
      }
    }
  }

  const publicFields =
    "id, display_name, age, photos, home_city, one_liner, trip_vibe";
  const [{ data: other }, { data: me }, { data: trips }, { data: messages }, { data: muteRow }] =
    await Promise.all([
      supabase.from("public_profiles").select(publicFields).eq("id", otherId).maybeSingle(),
      supabase.from("profiles").select("id, trip_vibe").eq("id", user!.id).maybeSingle(),
      supabase
        .from("trips")
        .select("id, destination, destinations, start_date, end_date")
        .eq("user_id", otherId)
        .eq("status", "active")
        .order("start_date", { ascending: true }),
      supabase
        .from("buddy_messages")
        .select("id, sender_id, content, created_at")
        .eq("chat_id", params.chatId)
        .order("created_at", { ascending: true })
        .limit(200),
      supabase
        .from("chat_mutes")
        .select("chat_id")
        .eq("user_id", user!.id)
        .eq("chat_id", params.chatId)
        .maybeSingle(),
    ]);

  const otherName = (other?.display_name || "your match").split(" ")[0];

  // Prefer the trip persisted on the match; fall back to soonest active trip.
  const todayIso = new Date().toISOString().slice(0, 10);
  const tripList = trips ?? [];
  type TripRow = {
    id?: string;
    destination?: string | null;
    destinations?: string[] | null;
    start_date?: string | null;
    end_date?: string | null;
  };
  let trip: TripRow | null = null;
  if (otherTripId) {
    trip = tripList.find((t) => t.id === otherTripId) ?? null;
    if (!trip) {
      const { data } = await supabase
        .from("trips")
        .select("id, destination, destinations, start_date, end_date")
        .eq("id", otherTripId)
        .maybeSingle();
      trip = data;
    }
  }
  if (!trip) {
    trip = tripList.find((t) => (t.end_date ?? "") >= todayIso) ?? tripList[0] ?? null;
  }
  const destination = trip?.destination ?? trip?.destinations?.[0] ?? null;

  let dateRange: string | null = null;
  if (trip?.start_date && trip?.end_date) {
    const s = new Date(trip.start_date);
    const e = new Date(trip.end_date);
    const days = Math.max(1, Math.round((+e - +s) / 86400000) + 1);
    dateRange = `${format(s, "MMM d")} → ${format(e, "MMM d")} · ${days} days`;
  }

  // Shared tags + compatibility score.
  const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
  const sharedVibe = arr(other?.trip_vibe).filter((t) => arr(me?.trip_vibe).includes(t));
  const common = sharedVibe;
  const score =
    matchExt?.score != null ? Math.round(Number(matchExt.score)) : null;

  const compatLine = common.length
    ? `You both align on ${common.slice(0, 3).join(", ").toLowerCase()}.`
    : "You've got a similar overall travel vibe.";

  const icebreaker =
    destination && dateRange
      ? `You both matched on ${destination}, ${dateRange}.\n${
          common.length ? `Compatible vibes: ${common.slice(0, 4).join(", ").toLowerCase()}.\n\n` : "\n"
        }Start planning together — exchange dates, share must-dos, and talk about what you're both hoping to get from this trip.`
      : `You both have a similar travel vibe${
          common.length ? ` — ${common.slice(0, 3).join(", ").toLowerCase()}` : ""
        }. Pick a destination together and start planning. No pressure.`;

  const peek: PeekData = {
    id: otherId,
    name: otherName,
    age: other?.age ?? null,
    city: other?.home_city ?? null,
    photos: arr(other?.photos),
    oneLiner: other?.one_liner ?? null,
    answers: [],
    tripVibe: arr(other?.trip_vibe),
    travelStyle: [],
  };

  const groupMembers = Object.entries(chatMembers).map(([id, mem]) => ({
    id,
    name: mem.name,
    photo: mem.photo,
    isHost: id === flockHostId,
  }));
  const isHostOfFlock = !!flockHostId && user!.id === flockHostId;

  // A Flock is a group already committed to a SPECIFIC trip — show that trip's
  // dates and a planning prompt, not the 1:1 "pick a destination together" copy.
  const isFlock = !!flockTripId;
  let flockDateRange: string | null = null;
  if (flockStart && flockEnd) {
    const s = new Date(flockStart);
    const e = new Date(flockEnd);
    const days = Math.max(1, Math.round((+e - +s) / 86400000) + 1);
    flockDateRange = `${format(s, "MMM d")} → ${format(e, "MMM d")} · ${days} days`;
  }
  const flockIcebreaker =
    `You're all going to ${flockTitle}${flockDateRange ? `, ${flockDateRange}` : ""}. 🎒\n` +
    `Say hi and start sorting it together — lock the dates that work, where you're staying, and the must-dos everyone wants in.`;
  const headerDestination = isFlock ? flockTitle : destination;
  const headerDateRange = isFlock ? flockDateRange : dateRange;
  const finalIcebreaker = isFlock ? flockIcebreaker : icebreaker;
  const finalTripStart = isFlock ? flockStart : trip?.start_date ?? null;
  const finalTripEnd = isFlock ? flockEnd : trip?.end_date ?? null;

  return (
    <main className="h-full">
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-5 font-nunito">
        <BuddyChatHeader
          matchId={chat.match_id}
          chatId={params.chatId}
          initialMuted={!!muteRow}
          name={otherName}
          age={other?.age ?? null}
          photo={arr(other?.photos)[0] ?? null}
          otherCity={other?.home_city ?? null}
          destination={headerDestination}
          dateRange={headerDateRange}
          score={score}
          sharedVibe={sharedVibe}
          sharedTravelStyle={[]}
          compatLine={compatLine}
          peek={peek}
          isGroup={!!flockTripId}
          groupTitle={flockTitle}
          groupMembers={groupMembers}
        />

        {flockTripId && flockReqs.length > 0 && (
          <div className="shrink-0">
            <FlockJoinRequests tripId={flockTripId} requests={flockReqs} dualApproval={!!flockCoHost} canRemove={isHostOfFlock} />
          </div>
        )}

        <BuddyChatRoom
          chatId={params.chatId}
          currentUserId={user!.id}
          otherId={otherId}
          otherName={otherName}
          initialMessages={messages ?? []}
          icebreaker={finalIcebreaker}
          tripStartIso={finalTripStart}
          tripEndIso={finalTripEnd}
          members={chatMembers}
          isGroup={!!flockTripId}
        />
      </div>
    </main>
  );
}
