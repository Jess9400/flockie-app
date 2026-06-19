"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ReviewForm({
  subjectId,
  subjectName,
  initialRating,
  initialComment,
}: {
  subjectId: string;
  subjectName: string;
  initialRating: number;
  initialComment: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [rating, setRating] = useState(initialRating);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(initialComment);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) return setErr("Pick a star rating.");
    setSaving(true);
    setErr(null);
    const { error } = await supabase.rpc("submit_review", {
      p_subject: subjectId,
      p_rating: rating,
      p_comment: comment,
    });
    setSaving(false);
    if (error) return setErr(error.message);
    router.push(`/people/${subjectId}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="font-nunito">
      <div className="flex justify-center gap-2 py-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(i)}
            aria-label={`${i} star${i > 1 ? "s" : ""}`}
          >
            <Star
              size={40}
              className={
                i <= (hover || rating)
                  ? "fill-flockie-coral text-flockie-coral"
                  : "text-navy/25"
              }
            />
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={500}
        placeholder={`What were ${subjectName} like to travel with? (optional)`}
        className="h-32 w-full resize-none rounded-2xl border-2 border-navy bg-cream px-4 py-3 font-nunito text-[15px] font-medium text-navy outline-none focus:border-flockie-blue"
      />

      {err && <p className="mt-2 text-center font-nunito text-sm font-bold text-flockie-coral">{err}</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-4 w-full rounded-full border-2 border-navy bg-flockie-coral py-3.5 font-fredoka text-base font-semibold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)] disabled:opacity-50"
      >
        {saving ? "Saving…" : "Submit review"}
      </button>
    </form>
  );
}
