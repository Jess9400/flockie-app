import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil, MapPin, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import DeleteTripButton from "@/components/DeleteTripButton";
import PageTabs from "@/components/PageTabs";

const TRIP_TABS = [
  { href: "/my-trips", label: "My Trips" },
  { href: "/my-activities", label: "My Activities" },
  { href: "/deals", label: "Deals" },
];

export default async function MyActivitiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: activities } = await supabase
    .from("trips")
    .select("id, title, destination, destinations, start_date, end_date, trip_type, status, created_at, cover_photo")
    .eq("user_id", user!.id)
    .eq("kind", "activity")
    .order("created_at", { ascending: false });

  return (
    <main className="px-5 pb-10 pt-6">
      <PageTabs tabs={TRIP_TABS} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">My Activities</h1>
        <Link
          href="/match/trip?kind=activity"
          className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-flockie-orange px-4 py-2 text-sm font-bold text-white shadow-[0_3px_0_0_#E0512C]"
        >
          <Plus size={16} /> New
        </Link>
      </div>
      <p className="mt-1 text-sm font-medium text-muted">
        1:1 things to do in your city — manage your activity posts.
      </p>

      <div className="mt-6 space-y-3">
        {(activities ?? []).length === 0 && (
          <div className="rounded-3xl border-2 border-dashed border-ink/30 py-12 text-center font-medium text-muted">
            No activities yet. Post one to find a buddy to do it with.
          </div>
        )}
        {(activities ?? []).map((t) => (
          <div
            key={t.id}
            className="rounded-2xl border-2 border-ink bg-white p-4 shadow-[0_3px_0_0_rgba(26,26,26,1)]"
          >
            <div className="flex items-start justify-between gap-3">
              {t.cover_photo && (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-ink">
                  <Image src={t.cover_photo} alt="" fill sizes="64px" className="object-cover" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border-2 border-ink bg-flockie-blue px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">
                    Activity
                  </span>
                  {t.status !== "active" && (
                    <span className="text-[10px] font-bold uppercase text-muted">{t.status}</span>
                  )}
                </div>
                <p className="mt-1 flex items-center gap-1.5 font-extrabold">
                  <MapPin size={15} className="text-flockie-orange" />{" "}
                  {t.title || (t.destinations ?? [t.destination]).filter(Boolean).join(" · ")}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-muted">
                  <CalendarClock size={13} /> {t.start_date} → {t.end_date}
                </p>
                {(t.trip_type?.length ?? 0) > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {t.trip_type!.map((tag: string) => (
                      <span key={tag} className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-bold">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/match/trip?id=${t.id}`}
                  className="flex shrink-0 items-center gap-1 rounded-full border-2 border-ink bg-white px-3 py-1.5 text-sm font-bold"
                >
                  <Pencil size={14} /> Edit
                </Link>
                <DeleteTripButton tripId={t.id} label={t.title ? `"${t.title}"` : "this activity"} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
