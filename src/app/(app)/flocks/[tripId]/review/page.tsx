import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Star, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type Target = { user_id: string; display_name: string | null; photo: string | null; reviewed: boolean };

export default async function FlockReviewPage({ params }: { params: { tripId: string } }) {
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("destination, destinations")
    .eq("id", params.tripId)
    .maybeSingle();
  const dest = trip
    ? (trip.destinations ?? [trip.destination]).filter(Boolean).join(" · ") || "your Flock"
    : "your Flock";

  const { data } = await supabase.rpc("flock_review_targets", { p_trip: params.tripId });
  const targets = (data ?? []) as Target[];

  return (
    <main className="mx-auto w-full max-w-[600px] px-6 pb-12 pt-6 font-nunito">
      <Link href="/flocks" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-navy/60 hover:text-navy">
        <ChevronLeft size={16} /> Back
      </Link>

      <h1 className="font-fredoka text-3xl font-bold text-navy">Review your group</h1>
      <p className="mt-1 font-nunito text-sm font-normal text-navy/60">
        {dest} — rate each person and leave a short note. It helps great travel buddies stand out.
      </p>

      {targets.length === 0 ? (
        <div className="mt-6 rounded-2xl border-2 border-navy bg-[#FCF9F4] p-6 text-center font-nunito text-sm font-medium text-navy/70">
          No one to review here yet.
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          {targets.map((t) => (
            <Link
              key={t.user_id}
              href={`/review/${t.user_id}`}
              className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-white p-3"
            >
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-flockie-blue">
                {t.photo ? (
                  <Image src={t.photo} alt="" fill sizes="44px" className="object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-sm font-extrabold text-white">
                    {(t.display_name || "F")[0]}
                  </span>
                )}
              </div>
              <p className="min-w-0 flex-1 truncate text-sm font-extrabold text-navy">
                {t.display_name || "A flockie"}
              </p>
              {t.reviewed ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-muted">
                  <Check size={14} /> Reviewed
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-1 rounded-full border-2 border-ink bg-flockie-coral px-3 py-1.5 text-xs font-bold text-white">
                  <Star size={14} /> Review
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
