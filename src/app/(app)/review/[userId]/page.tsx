import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ReviewForm from "@/components/ReviewForm";

export default async function ReviewPage({
  params,
}: {
  params: { userId: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user!.id === params.userId) notFound();

  const { data: subject } = await supabase
    .from("public_profiles")
    .select("display_name")
    .eq("id", params.userId)
    .maybeSingle();
  if (!subject) notFound();

  const { data: existing } = await supabase
    .from("reviews")
    .select("rating, comment")
    .eq("reviewer_id", user!.id)
    .eq("subject_id", params.userId)
    .maybeSingle();

  const name = (subject.display_name || "your buddy").split(" ")[0];

  return (
    <main className="mx-auto w-full max-w-[600px] px-6 pb-12 pt-6 font-nunito">
      <Link
        href={`/people/${params.userId}`}
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-navy/60 hover:text-navy"
      >
        <ChevronLeft size={16} /> {name}&rsquo;s profile
      </Link>

      <h1 className="font-fredoka text-3xl font-bold text-navy">
        {existing ? "Edit your review" : `Review ${name}`}
      </h1>
      <p className="mt-1 font-nunito text-sm font-normal text-navy/60">
        Honest reviews keep Flockie safe and help great travel buddies stand out.
      </p>

      <div className="mt-4">
        <ReviewForm
          subjectId={params.userId}
          subjectName={name}
          initialRating={existing?.rating ?? 0}
          initialComment={existing?.comment ?? ""}
        />
      </div>
    </main>
  );
}
