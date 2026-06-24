import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import VibeReviewForm from "@/components/VibeReviewForm";

export default async function VibeReviewPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: vibe } = await supabase
    .from("vibes")
    .select("title, starts_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!vibe) notFound();

  const started = new Date(vibe.starts_at) <= new Date();

  const { data: interest } = await supabase
    .from("vibe_interests")
    .select("status")
    .eq("vibe_id", params.id)
    .eq("user_id", user!.id)
    .maybeSingle();
  const eligible = started && interest?.status === "confirmed";

  const { data: existing } = await supabase
    .from("vibe_reviews")
    .select("rating, tags, comment")
    .eq("vibe_id", params.id)
    .eq("reviewer_id", user!.id)
    .maybeSingle();

  return (
    <main className="mx-auto w-full max-w-[600px] px-6 pb-12 pt-6 font-nunito">
      <Link
        href={`/vibes/${params.id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-navy/60 hover:text-navy"
      >
        <ChevronLeft size={16} /> Back to Vibe
      </Link>

      <h1 className="font-fredoka text-3xl font-bold text-navy">
        {existing ? "Edit your review" : "Review this Vibe"}
      </h1>
      <p className="mt-1 font-nunito text-sm font-normal text-navy/60">{vibe.title}</p>

      {eligible ? (
        <div className="mt-5">
          <VibeReviewForm
            vibeId={params.id}
            initialRating={existing?.rating ?? null}
            initialTags={existing?.tags ?? []}
            initialComment={existing?.comment ?? ""}
          />
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border-2 border-navy bg-[#FCF9F4] p-6 text-center font-nunito text-sm font-medium text-navy/70">
          {started
            ? "Only confirmed attendees can review this Vibe."
            : "You can review this Vibe once it has started."}
        </div>
      )}
    </main>
  );
}
