"use client";

import { useState } from "react";
import { Plus, X, Video } from "lucide-react";

export default function PhotoGrid({
  photos,
  onRemovePhoto,
  onReorder,
  onAddPhoto,
  canAddPhoto,
  videoUrl,
  onAddVideo,
  onRemoveVideo,
  uploading,
}: {
  photos: string[];
  onRemovePhoto: (i: number) => void;
  onReorder: (from: number, to: number) => void;
  onAddPhoto: () => void;
  canAddPhoto: boolean;
  videoUrl: string | null;
  onAddVideo: () => void;
  onRemoveVideo: () => void;
  uploading: boolean;
}) {
  const [drag, setDrag] = useState<number | null>(null);

  function slot(i: number) {
    const url = photos[i];
    const isPrimary = i === 0;
    return (
      <div
        key={url ?? `empty-${i}`}
        draggable={!!url}
        onDragStart={() => setDrag(i)}
        onDragOver={(e) => url !== undefined && e.preventDefault()}
        onDrop={() => {
          if (drag !== null && drag !== i) onReorder(drag, i);
          setDrag(null);
        }}
        className={`group relative aspect-square overflow-hidden rounded-xl ${
          url ? "cursor-grab border-2 border-navy" : ""
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="h-full w-full object-cover" />
        {isPrimary && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-navy px-2 py-0.5 font-nunito text-[10px] font-bold uppercase tracking-wide text-white">
            Primary
          </span>
        )}
        <button
          type="button"
          onClick={() => onRemovePhoto(i)}
          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-navy text-white opacity-0 transition-opacity group-hover:opacity-100"
          aria-label="Remove photo"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {photos.map((_, i) => slot(i))}

        {canAddPhoto && (
          <button
            type="button"
            onClick={onAddPhoto}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-navy bg-cream text-navy"
          >
            <Plus size={22} />
            <span className="font-nunito text-[11px] font-semibold">Add photo</span>
          </button>
        )}

        {/* Video slot */}
        {videoUrl ? (
          <div className="relative aspect-square overflow-hidden rounded-xl border-2 border-navy">
            <video src={videoUrl} className="h-full w-full object-cover" />
            <span className="absolute left-1.5 top-1.5 rounded-full bg-flockie-blue px-2 py-0.5 font-nunito text-[10px] font-bold uppercase tracking-wide text-white">
              Video
            </span>
            <button
              type="button"
              onClick={onRemoveVideo}
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-navy text-white"
              aria-label="Remove video"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAddVideo}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-navy bg-cream text-navy"
          >
            <Video size={22} />
            <span className="font-nunito text-[11px] font-semibold">Video (optional)</span>
          </button>
        )}
      </div>
      {uploading && (
        <p className="mt-2 font-nunito text-sm font-semibold text-flockie-coral">Uploading…</p>
      )}
    </div>
  );
}
