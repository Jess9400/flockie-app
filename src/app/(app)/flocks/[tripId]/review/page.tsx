import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Star, Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

type Target = { user_id: string; display_name: string | null; photo: string | null; reviewed: boolean };

export default async function FlockReviewPage({ params }: { params: { tripId: string } }) {
  const t = await getTranslations("components");
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("destination, destinations")
    .eq("id", params.tripId)
    .maybeSingle();
  const dest = trip
    ? (trip.destinations ?? [trip.destination]).filter(Boolean).join(" · ") || t("flockReview.flockFallback")
    : t("flockReview.flockFallback");

  const { data } = await supabase.rpc("flock_review_targets", { p_trip: params.tripId });
  const targets = (data ?? []) as Target[];

  return (
    <main className="mx-auto w-full max-w-[600px] px-6 pb-12 pt-6 font-nunito">
      <Link href="/flocks" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-navy/60 hover:text-navy">
        <ChevronLeft size={16} /> {t("flockReview.back")}
      </Link>

      <h1 className="font-fredoka text-3xl font-bold text-navy">{t("flockReview.title")}</h1>
      <p className="mt-1 font-nunito text-sm font-normal text-navy/60">
        {t("flockReview.descPrefix", { dest })}
        <span className="font-bold">{t("flockReview.descBold")}</span>
        {t("flockReview.descSuffix")}
      </p>

      {targets.length === 0 ? (
        <div className="mt-6 rounded-2xl border-2 border-navy bg-[#FCF9F4] p-6 text-center font-nunito text-sm font-medium text-navy/70">
          {t("flockReview.empty")}
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          {targets.map((target) => (
            <Link
              key={target.user_id}
              href={`/review/${target.user_id}`}
              className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-white p-3"
            >
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-flockie-blue">
                {target.photo ? (
                  <Image src={target.photo} alt="" fill sizes="44px" className="object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-sm font-extrabold text-white">
                    {(target.display_name || "F")[0]}
                  </span>
                )}
              </div>
              <p className="min-w-0 flex-1 truncate text-sm font-extrabold text-navy">
                {target.display_name || t("flockReview.flockieFallback")}
              </p>
              {target.reviewed ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-muted">
                  <Check size={14} /> {t("flockReview.badgeReviewed")}
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-1 rounded-full border-2 border-ink bg-flockie-coral px-3 py-1.5 text-xs font-bold text-white">
                  <Star size={14} /> {t("flockReview.badgeReview")}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
