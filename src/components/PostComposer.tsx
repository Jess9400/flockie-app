"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export type PostAnchor = {
  kind: "vibe" | "club" | "activity";
  id: string;
  title: string;
  sub: string;
};

const KIND_EMOJI: Record<string, string> = { vibe: "🎉", club: "🔁", activity: "🤝" };

// Share a recap: pick the real thing it's about (required), say something,
// add photos. No free-floating posts - that's the whole point.
export default function PostComposer({
  anchors,
  userId,
}: {
  anchors: PostAnchor[];
  userId: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("feed.composer");
  const [picked, setPicked] = useState<PostAnchor | null>(null);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || photos.length >= 4) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/post-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      setPhotos((cur) => [...cur, supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl]);
    } catch {
      setError(t("photoError"));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function publish() {
    if (!picked || busy) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("create_post", {
      p_kind: picked.kind,
      p_anchor: picked.id,
      p_body: body.trim(),
      p_photos: photos,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/home");
    router.refresh();
  }

  return (
    <div className="rounded-3xl border border-ink/15 bg-white p-5 shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
      <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{t("stepAnchor")}</p>
      {anchors.length === 0 ? (
        <p className="mt-2 rounded-2xl border-2 border-dashed border-ink/20 bg-cream p-4 text-sm font-medium text-muted">
          {t("noAnchors")}
        </p>
      ) : (
        <>
          <div className="relative mt-2">
            <select
              value={picked ? `${picked.kind}:${picked.id}` : ""}
              onChange={(e) => {
                const [kind, id] = e.target.value.split(":");
                setPicked(anchors.find((a) => a.kind === kind && a.id === id) ?? null);
              }}
              className="w-full appearance-none rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 pr-10 text-sm font-bold text-ink outline-none focus:border-flockie-coral"
            >
              <option value="" disabled>
                {t("anchorPlaceholder")}
              </option>
              {(["vibe", "club", "activity"] as const).map((kind) => {
                const group = anchors.filter((a) => a.kind === kind);
                if (group.length === 0) return null;
                return (
                  <optgroup key={kind} label={`${KIND_EMOJI[kind]} ${t(`group.${kind}`)}`}>
                    {group.map((a) => (
                      <option key={`${a.kind}-${a.id}`} value={`${a.kind}:${a.id}`}>
                        {a.title} - {a.sub}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/50" />
          </div>
          {picked && (
            <div className="mt-2 flex items-center gap-2 rounded-2xl border-2 border-flockie-coral/40 bg-flockie-coral/5 px-3 py-2.5">
              <span className="text-lg">{KIND_EMOJI[picked.kind]}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-extrabold text-ink">{picked.title}</span>
                <span className="block truncate text-[11px] font-medium text-muted">{picked.sub}</span>
              </span>
            </div>
          )}
        </>
      )}

      <p className="mt-5 text-xs font-extrabold uppercase tracking-wide text-muted">{t("stepBody")}</p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("bodyPlaceholder")}
        maxLength={1000}
        rows={3}
        className="mt-2 w-full resize-none rounded-2xl border border-ink/25 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-flockie-blue"
      />

      <p className="mt-4 text-xs font-extrabold uppercase tracking-wide text-muted">{t("stepPhotos")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {photos.map((url, i) => (
          <div key={url} className="relative h-20 w-20 overflow-hidden rounded-xl border border-ink/15">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => setPhotos((cur) => cur.filter((_, j) => j !== i))}
              aria-label={t("removePhoto")}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-white"
            >
              ✕
            </button>
          </div>
        ))}
        {photos.length < 4 && (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-ink/30 text-xl text-muted disabled:opacity-50"
          >
            {uploading ? "…" : "📷"}
          </button>
        )}
        <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
      </div>

      <button
        type="button"
        disabled={!picked || busy || uploading}
        onClick={publish}
        className="mt-5 w-full rounded-full border-2 border-ink bg-flockie-coral py-3 font-bold text-white shadow-[0_2px_0_0_#E0512C] disabled:opacity-50"
      >
        {busy ? t("posting") : picked ? t("cta") : t("ctaDisabled")}
      </button>
      {error && <p className="mt-2 text-center text-sm font-bold text-red-700">{error}</p>}
      <p className="mt-3 text-center text-[11px] font-medium text-muted">{t("anchorNote")}</p>
    </div>
  );
}
