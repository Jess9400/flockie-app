"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { VIBE_REVIEW_TAGS } from "@/lib/vibes";
import { Chip } from "@/components/profileControls";

const RATING_LABELS = ["", "Not for me", "Meh", "Good", "Great", "Loved it"];

export default function VibeReviewForm({
  vibeId,
  initialRating,
  initialTags,
  initialComment,
}: {
  vibeId: string;
  initialRating: number | null;
  initialTags: string[];
  initialComment: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [rating, setRating] = useState<number>(initialRating ?? 0);
  const [hover, setHover] = useState(0);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [comment, setComment] = useState(initialComment);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleTag(t: string) {
    setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) return setErr("Tap a star to rate this Vibe.");
    setSaving(true);
    setErr(null);
    const { error } = await supabase.rpc("submit_vibe_review", {
      p_vibe: vibeId,
      p_rating: rating,
      p_tags: tags,
      p_comment: comment,
    });
    setSaving(false);
    if (error) return setErr(error.message);
    router.push(`/vibes/${vibeId}`);
    router.refresh();
  }

  const shown = hover || rating;

  return (
    <form onSubmit={submit} className="font-nunito">
      <p className="font-nunito text-sm font-semibold text-navy">How was it?</p>
      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setRating(i)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${i} star${i > 1 ? "s" : ""}`}
            className="p-0.5"
          >
            <Star
              size={36}
              className={i <= shown ? "fill-flockie-coral text-flockie-coral" : "text-navy/25"}
            />
          </button>
        ))}
        {shown > 0 && (
          <span className="ml-2 font-nunito text-sm font-bold text-navy/60">{RATING_LABELS[shown]}</span>
        )}
      </div>

      <p className="mt-6 font-nunito text-sm font-semibold text-navy">
        What was it like? <span className="font-normal text-navy/50">(pick any)</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {VIBE_REVIEW_TAGS.map((t) => (
          <Chip key={t} label={t} selected={tags.includes(t)} onClick={() => toggleTag(t)} />
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={500}
        placeholder="Anything else? (optional)"
        className="mt-6 h-28 w-full resize-none rounded-2xl border-2 border-navy bg-cream px-4 py-3 font-nunito text-[15px] font-medium text-navy outline-none focus:border-flockie-blue"
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
