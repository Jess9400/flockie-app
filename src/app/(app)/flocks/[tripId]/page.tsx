import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, MapPin, CalendarClock, Users, Globe2, Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import FlockRequestButton from "@/components/FlockRequestButton";
import TripAgendaPreview from "@/components/TripAgendaPreview";
import PhotoStrip from "@/components/PhotoStrip";
import ArchetypeBadge from "@/components/ArchetypeBadge";
import { loadFlockMatch } from "@/lib/vibe-stats";
import { tripDays } from "@/lib/trips";
import { ARCHETYPES } from "@/lib/onboarding/archetypes";
import type { VibeDimension } from "@/lib/onboarding/types";

// Friendly unavailable state — same graceful pattern as the Vibe detail page
// (no hard 404: the Flock may simply be cancelled, deleted, or private).
async function Unavailable() {
  const tr = await getTranslations("flocks");
  return (
    <main className="mx-auto w-full max-w-md px-5 pt-16 text-center font-nunito">
      <p className="text-4xl">🧳</p>
      <h1 className="mt-3 text-xl font-black">{tr("detail.unavailableTitle")}</h1>
      <p className="mt-1 font-medium text-muted">{tr("detail.unavailableBody")}</p>
      <Link
        href="/flocks"
        className="mt-6 inline-block rounded-full border border-ink/15 bg-flockie-orange px-5 py-2.5 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
      >
        {tr("detail.exploreFlocks")}
      </Link>
    </main>
  );
}

export default async function FlockDetailPage({
  params,
}: {
  params: { tripId: string };
}) {
  const supabase = await createClient();
  const user = await getSessionUser();
  const tr = await getTranslations("flocks");

  // Same table/columns the browse page reads; RLS (can_see_trip) already allows
  // owner / co-host / public / accepted member — see supabase/trips-rls.sql.
  const { data: trip } = await supabase
    .from("trips")
    .select(
      "id, user_id, co_host_id, destination, destinations, start_date, end_date, group_size, trip_type, cover_photo, gallery, continent, group_gender, language, budget, pace, description, status, visibility, kind"
    )
    .eq("id", params.tripId)
    .eq("kind", "trip")
    .maybeSingle();

  if (!trip) return <Unavailable />;

  const isHost = trip.user_id === user!.id || trip.co_host_id === user!.id;
  // Non-hosts only see public, active Flocks (cancelled/private degrade gracefully).
  if (!isHost && (trip.status !== "active" || trip.visibility !== "public")) {
    return <Unavailable />;
  }

  const ended = trip.end_date < new Date().toISOString().slice(0, 10);

  // Going count via the same definer RPC the browse page uses (no row exposure).
  const [{ data: counts }, { data: myReq }, { data: host }] = await Promise.all([
    supabase.rpc("flock_going_counts", { p_trip_ids: [trip.id] }),
    isHost
      ? Promise.resolve({ data: null })
      : supabase
          .from("trip_join_requests")
          .select("status")
          .eq("trip_id", trip.id)
          .eq("user_id", user!.id)
          .maybeSingle(),
    supabase
      .from("public_profiles")
      .select("id, display_name, photos, one_liner, archetype")
      .eq("id", trip.user_id)
      .maybeSingle(),
  ]);

  const accepted = (counts ?? [])[0]?.accepted ?? 0;
  const going = 1 + accepted;
  const isFull = going >= trip.group_size;

  // Members (host + accepted) get the roster + planning workspace.
  const isMember = isHost || myReq?.status === "accepted";
  const { data: rosterRows } = isMember
    ? await supabase.rpc("trip_members", { p_trip: trip.id })
    : { data: null };
  type RosterM = { id: string; display_name: string | null; photo: string | null; is_host: boolean };
  const roster = (rosterRows ?? []) as RosterM[];
  const days = tripDays(trip.start_date, trip.end_date);
  const destination = (trip.destinations ?? [trip.destination]).filter(Boolean).join(" · ");
  const hostName = host?.display_name || tr("browse.hostFallback");
  const archetype = host?.archetype ? ARCHETYPES[host.archetype as VibeDimension] : null;

  // Vibe-match % (viewer vs this Flock) — only meaningful for non-hosts.
  const pct = isHost ? undefined : (await loadFlockMatch(supabase, [trip.id]))[trip.id];

  // Join gate: same Trip-form check the browse page applies (migration-safe).
  let tripPrefsDone = true;
  if (!isHost) {
    const { data: prefRow, error: prefErr } = await supabase
      .from("profiles")
      .select("trip_prefs_complete")
      .eq("id", user!.id)
      .maybeSingle();
    tripPrefsDone = prefErr ? true : !!prefRow?.trip_prefs_complete;
  }

  // Host view: pending join requests (host can read requests to their own trips).
  let pendingCount = 0;
  if (isHost) {
    const { count } = await supabase
      .from("trip_join_requests")
      .select("trip_id", { count: "exact", head: true })
      .eq("trip_id", trip.id)
      .eq("status", "pending");
    pendingCount = count ?? 0;
  }

  const budgetLabel =
    typeof trip.budget === "number"
      ? trip.budget <= 2
        ? tr("budget.friendly")
        : trip.budget === 3
          ? tr("budget.mid")
          : tr("budget.comfort")
      : null;

  return (
    <main className="px-5 pb-10 pt-6">
      <Link href="/flocks" className="flex items-center gap-1 text-sm font-bold text-ink/60">
        <ChevronLeft size={16} /> {tr("detail.back")}
      </Link>

      {/* Cover */}
      <div className="relative mt-4 aspect-square w-full overflow-hidden rounded-3xl border border-ink/15 bg-cream shadow-[0_2px_10px_rgba(10,37,69,0.08)] sm:aspect-[16/9]">
        {trip.cover_photo ? (
          <Image
            src={trip.cover_photo}
            alt=""
            fill
            sizes="(max-width:640px) 100vw, 768px"
            className="object-contain"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl">🧳</div>
        )}
        {typeof pct === "number" && (
          <span className="absolute right-3 top-3 rounded-full border border-ink/15 bg-flockie-blue px-2.5 py-1 text-xs font-extrabold text-white">
            ✨ {tr("detail.matchBadge", { pct })}
          </span>
        )}
      </div>

      {Array.isArray(trip.gallery) && trip.gallery.length > 0 && (
        <div className="mt-3">
          <PhotoStrip photos={trip.gallery as string[]} />
        </div>
      )}

      {/* Essentials */}
      <h1 className="mt-5 flex items-start gap-2 text-2xl font-black leading-tight">
        <MapPin size={22} className="mt-1 shrink-0 text-flockie-orange" />
        <span>{destination}</span>
      </h1>
      <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-muted">
        <CalendarClock size={15} className="shrink-0" />
        {trip.start_date} → {trip.end_date}
        {days > 0 && ` · ${tr("detail.days", { count: days })}`}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-ink">
        <Users size={15} className="shrink-0" /> {tr("detail.going", { going, capacity: trip.group_size })}
        {isFull && <span className="text-muted">· {tr("detail.full")}</span>}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {trip.group_gender === "women" && (
          <span className="rounded-full border border-ink/15 bg-flockie-coral/15 px-2.5 py-1 text-xs font-bold text-flockie-coral">
            {tr("detail.womenOnly")}
          </span>
        )}
        {trip.continent && (
          <span className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white px-2.5 py-1 text-xs font-bold text-ink/70">
            <Globe2 size={12} /> {trip.continent}
          </span>
        )}
        {trip.language && (
          <span className="rounded-full border border-ink/15 bg-white px-2.5 py-1 text-xs font-bold text-ink/70">
            🗣 {trip.language}
          </span>
        )}
        {budgetLabel && (
          <span className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white px-2.5 py-1 text-xs font-bold text-ink/70">
            <Wallet size={12} /> {budgetLabel}
          </span>
        )}
        {(trip.trip_type ?? []).map((t: string) => (
          <span key={t} className="rounded-full border border-ink/15 bg-cream px-2.5 py-1 text-xs font-bold text-ink/70">
            {t}
          </span>
        ))}
      </div>

      {/* Full description */}
      {trip.description && (
        <div className="mt-5 rounded-2xl border border-ink/15 bg-white p-4 shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
          <p className="text-sm font-extrabold">{tr("detail.aboutHeading")}</p>
          <p className="mt-1.5 whitespace-pre-line text-sm font-medium leading-relaxed text-ink/80">
            {trip.description}
          </p>
        </div>
      )}

      {/* Host card */}
      <Link
        href={`/people/${trip.user_id}`}
        className="mt-4 flex items-center gap-3 rounded-2xl border border-ink/15 bg-white p-4 shadow-[0_2px_10px_rgba(10,37,69,0.08)] transition-transform active:translate-y-[2px]"
      >
        {host?.photos?.[0] ? (
          <Image
            src={host.photos[0]}
            alt=""
            width={52}
            height={52}
            className="h-13 w-13 shrink-0 rounded-full border border-ink/15 object-cover"
            style={{ height: 52, width: 52 }}
          />
        ) : (
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-ink/15 bg-flockie-blue text-lg font-bold text-white">
            {hostName[0]}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-muted">{tr("detail.hostedBy")}</span>
          <span className="block truncate text-base font-extrabold text-ink">{hostName}</span>
          {archetype ? (
            <span className="mt-0.5 flex items-center gap-1.5 text-xs font-bold text-ink/70">
              <ArchetypeBadge archetypeKey={host!.archetype!} size={18} /> {archetype.name}
            </span>
          ) : (
            host?.one_liner && (
              <span className="block truncate text-xs font-medium text-muted">{host.one_liner}</span>
            )
          )}
        </span>
        <span className="shrink-0 text-sm font-bold text-flockie-blue">{tr("detail.view")}</span>
      </Link>

      {/* Action area */}
      <div className="mt-6">
        {isHost ? (
          <div className="rounded-2xl border border-ink/15 bg-cream p-4">
            <p className="text-sm font-extrabold">
              {tr("detail.hostingTitle")}
              {trip.status !== "active" && <span className="text-muted"> {tr("detail.noLongerActive")}</span>}
            </p>
            <p className="mt-0.5 text-xs font-medium text-muted">
              {pendingCount > 0
                ? tr("detail.pendingRequests", { count: pendingCount })
                : tr("detail.noPending")}
            </p>
            <Link
              href="/my-trips"
              className="mt-3 inline-block rounded-full border border-ink/15 bg-flockie-blue px-5 py-2.5 text-sm font-bold text-white"
            >
              {tr("detail.manageInMyTrips")}
            </Link>
          </div>
        ) : myReq?.status === "accepted" ? (
          <div className="rounded-2xl border border-ink/15 bg-[#06D6A0]/10 p-4 text-center">
            <p className="font-extrabold text-ink">{tr("detail.inFlock")}</p>
            <Link href="/chats" className="mt-2 inline-block text-sm font-bold text-flockie-blue underline">
              {tr("detail.openChats")}
            </Link>
          </div>
        ) : ended ? (
          <div className="rounded-2xl border border-ink/15 bg-cream p-4 text-center font-bold text-muted">
            {tr("detail.datesPassed")}
          </div>
        ) : isFull && !myReq ? (
          <div className="rounded-2xl border border-ink/15 bg-cream p-4 text-center font-bold text-muted">
            {tr("detail.flockFull")}
          </div>
        ) : (
          <FlockRequestButton
            tripId={trip.id}
            // Only a live request counts as "requested" — a declined one lets
            // you ask again (consistent with the browse list's status filter).
            requested={myReq?.status === "pending" || myReq?.status === "waiting"}
            tripPrefsDone={tripPrefsDone}
          />
        )}
      </div>

      <TripAgendaPreview tripId={trip.id} />

      {isMember && roster.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-extrabold uppercase tracking-wide text-ink/50">{tr("detail.whosGoing")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {roster.map((m) => (
              <Link key={m.id} href={`/people/${m.id}`} className="flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-2 py-1 text-xs font-bold text-ink">
                {m.photo ? (
                  <Image src={m.photo} alt="" width={20} height={20} className="h-5 w-5 rounded-full object-cover" />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-flockie-blue text-[10px] font-bold text-white">{(m.display_name ?? "?")[0]?.toUpperCase()}</span>
                )}
                {m.display_name ?? "Flockie"}
                {m.is_host && <span className="text-flockie-coral">★</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      
    </main>
  );
}
