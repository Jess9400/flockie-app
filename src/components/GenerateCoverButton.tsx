"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("components");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    if (!prompt.trim()) {
      setErr(t("generateCover.errNoTitle"));
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
            ? t("generateCover.errCredits")
            : res.status === 429
              ? t("generateCover.errTooMany")
              : (j as { error?: string }).error || t("generateCover.errGeneric"),
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
      setErr((e as Error).message ?? t("generateCover.errGeneric"));
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
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-ink/15 bg-white py-2.5 text-sm font-bold text-ink disabled:opacity-50"
      >
        <Sparkles size={16} className="text-flockie-orange" />
        {loading ? t("generateCover.busy") : t("generateCover.button")}
      </button>
      <p className="mt-1 text-xs font-medium text-muted">
        {t("generateCover.helper")}
      </p>
      {err && <p className="mt-1 text-xs font-bold text-flockie-orange">{err}</p>}
    </div>
  );
}
