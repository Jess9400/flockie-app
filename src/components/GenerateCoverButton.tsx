"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// "Generate a cover" — asks the AI Gateway for a stylized cover image, uploads
// the result to the avatars bucket (same place uploaded covers go), and hands
// back the public URL. Used in the Create flows when a host has no photo.
export default function GenerateCoverButton({
  userId,
  prompt,
  disabled,
  onUploaded,
}: {
  userId: string;
  prompt: string;
  disabled?: boolean;
  onUploaded: (url: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    if (!prompt.trim()) {
      setErr("Add a title first so we know what to draw.");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/generate-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          res.status === 402
            ? "AI image credits are used up for now."
            : res.status === 429
              ? "Too many tries — give it a sec."
              : (j as { error?: string }).error || "Couldn't generate a cover.",
        );
      }
      const { base64, mediaType } = (await res.json()) as { base64: string; mediaType: string };
      const blob = await (await fetch(`data:${mediaType};base64,${base64}`)).blob();
      const supabase = createClient();
      const path = `${userId}/cover-gen-${crypto.randomUUID()}.png`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: mediaType });
      if (error) throw error;
      onUploaded(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
    } catch (e) {
      setErr((e as Error).message ?? "Couldn't generate a cover.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={generate}
        disabled={disabled || loading}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-white py-2.5 text-sm font-bold text-ink disabled:opacity-50"
      >
        <Sparkles size={16} className="text-flockie-orange" />
        {loading ? "Generating cover…" : "Generate a cover with AI"}
      </button>
      <p className="mt-1 text-xs font-medium text-muted">
        Makes an illustrated cover from your title — not a photo of people.
      </p>
      {err && <p className="mt-1 text-xs font-bold text-flockie-orange">{err}</p>}
    </div>
  );
}
