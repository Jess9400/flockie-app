"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2, Upload, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type ClubMediaItem = {
  id: string;
  path: string;
  kind: "photo" | "video" | "file";
  title: string | null;
  url: string | null;
  uploadedBy: string;
  paidOnly: boolean;
};

const MAX_FILE_BYTES = 50 * 1024 * 1024; // matches the bucket's file_size_limit

function kindOf(file: File): ClubMediaItem["kind"] {
  if (file.type.startsWith("image/")) return "photo";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

// Members-only gallery backed by the private club-media bucket. Uploads are
// host/moderator only (storage + table RLS enforce it server-side too).
export default function ClubMediaGallery({
  clubId,
  items,
  canManage,
  isHost,
  userId,
}: {
  clubId: string;
  items: ClubMediaItem[];
  canManage: boolean;
  isHost: boolean;
  userId: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("clubs.media");
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  // Next upload lands as socio-only content (paid tier); RLS hides those
  // items from free members - see supabase/club-socio-tier.sql.
  const [uploadPaidOnly, setUploadPaidOnly] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setErr(null);
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_BYTES) {
        setErr(t("errTooLarge", { name: file.name }));
        continue;
      }
      const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
      const path = `${clubId}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("club-media").upload(path, file);
      if (upErr) {
        setErr(upErr.message);
        continue;
      }
      const { error: rowErr } = await supabase.from("club_media").insert({
        club_id: clubId,
        path,
        kind: kindOf(file),
        title: file.name.slice(0, 140),
        uploaded_by: userId,
        paid_only: uploadPaidOnly,
      });
      if (rowErr) {
        // Keep storage consistent with the table if the metadata insert fails.
        await supabase.storage.from("club-media").remove([path]);
        setErr(rowErr.message);
      }
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  async function remove(item: ClubMediaItem) {
    if (!confirm(t("deleteConfirm"))) return;
    setErr(null);
    const { error } = await supabase.from("club_media").delete().eq("id", item.id);
    if (error) return setErr(error.message);
    await supabase.storage.from("club-media").remove([item.path]);
    setGone((prev) => new Set(prev).add(item.id));
    router.refresh();
  }

  const visible = items.filter((item) => !gone.has(item.id));

  return (
    <div className="mt-5">
      {canManage && (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-flockie-blue px-5 py-2.5 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:opacity-50"
            >
              <Upload size={16} /> {busy ? t("uploading") : t("upload")}
            </button>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-ink">
              <input
                type="checkbox"
                checked={uploadPaidOnly}
                onChange={(e) => setUploadPaidOnly(e.target.checked)}
                className="h-4 w-4 accent-flockie-orange"
              />
              {t("paidOnlyToggle")}
            </label>
          </div>
        </>
      )}
      {err && <p className="mt-2 text-sm font-bold text-flockie-coral">{err}</p>}

      {visible.length === 0 && !busy && (
        <p className="mt-4 rounded-2xl bg-cream p-4 text-sm font-medium text-muted">
          {canManage ? t("emptyManager") : t("emptyMember")}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visible.map((item) => {
          const canDelete = item.uploadedBy === userId || isHost;
          return (
            <div
              key={item.id}
              className="group relative overflow-hidden rounded-2xl border border-ink/10 bg-white"
            >
              {item.kind === "photo" && item.url && (
                // eslint-disable-next-line @next/next/no-img-element -- signed URLs expire; next/image caching would break them
                <img src={item.url} alt={item.title ?? ""} className="h-36 w-full object-cover" />
              )}
              {item.kind === "video" && item.url && (
                <video src={item.url} controls preload="metadata" className="h-36 w-full bg-ink object-contain" />
              )}
              {item.kind === "file" && item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-36 flex-col items-center justify-center gap-2 p-3 text-center"
                >
                  <FileText size={28} className="text-flockie-blue" />
                  <span className="line-clamp-2 break-all text-xs font-bold text-ink">
                    {item.title ?? t("fileFallback")}
                  </span>
                </a>
              )}
              {item.paidOnly && (
                <span className="absolute left-2 top-2 rounded-full bg-flockie-orange px-2 py-0.5 text-[10px] font-extrabold text-white">
                  ⭐ {t("paidOnlyBadge")}
                </span>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => remove(item)}
                  aria-label={t("deleteAria")}
                  className="absolute right-2 top-2 rounded-full border border-ink/15 bg-white/90 p-1.5 text-ink opacity-90"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
