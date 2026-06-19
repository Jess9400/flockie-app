"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { VIBE_REVIEW_TAGS } from "@/lib/vibes";
import { Chip } from "@/components/profileControls";

export default function VibeReviewForm({
  vibeId,
  initialRecommend,
  initialTags,
  initialComment,
}: {
  vibeId: string;
  initialRecommend: boolean | null;
  initialTags: string[];
  initialComment: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [recommend, setRecommend] = useState<boolean | null>(initialRecommend);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [comment, setComment] = useState(initialComment);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleTag(t: string) {
    setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (recommend === null) return setErr("Would you recommend this Vibe?");
    setSaving(true);
    setErr(null);
    const { error } = await supabase.rpc("submit_vibe_review", {
      p_vibe: vibeId,
      p_recommend: recommend,
      p_tags: tags,
      p_comment: comment,
    });
    setSaving(false);
    if (error) return setErr(error.message);
    router.push(`/vibes/${vibeId}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="font-nunito">
      <p className="font-nunito text-sm font-semibold text-navy">Would you recommend this Vibe?</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setRecommend(true)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-navy py-3 font-fredoka text-sm font-semibold ${
            recommend === true ? "bg-flockie-coral text-white" : "bg-white text-navy"
          }`}
        >
          <ThumbsUp size={16} /> Yes
        </button>
        <button
          type="button"
          onClick={() => setRecommend(false)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-navy py-3 font-fredoka text-sm font-semibold ${
            recommend === false ? "bg-navy text-white" : "bg-white text-navy"
          }`}
        >
          <ThumbsDown size={16} /> Not really
        </button>
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
