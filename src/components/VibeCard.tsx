import Image from "next/image";
import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import { formatVibeWhen, type InterestStatus } from "@/lib/vibes";

export type VibeCardData = {
  id: string;
  title: string;
  category: string;
  photos: string[] | null;
  city: string;
  location_name: string | null;
  starts_at: string;
  capacity: number;
  event_vibe_tags: string[] | null;
  host: { display_name: string | null; photos: string[] | null } | null;
};

const STATUS_LABEL: Record<string, string> = {
  interested: "Interested",
  invited: "Invited",
  confirmed: "Confirmed",
  standby: "Standby",
};

export default function VibeCard({
  vibe,
  confirmedCount,
  myStatus,
  matchPct,
}: {
  vibe: VibeCardData;
  confirmedCount: number;
  myStatus?: InterestStatus | null;
  matchPct?: number;
}) {
  const cover = vibe.photos?.[0];
  const hostName = vibe.host?.display_name || "A flockie";
  const hostAvatar = vibe.host?.photos?.[0];

  return (
    <Link
      href={`/vibes/${vibe.id}`}
      className="block overflow-hidden rounded-3xl border-2 border-ink bg-white shadow-[0_5px_0_0_rgba(26,26,26,1)] transition-transform hover:-translate-y-1"
    >
      <div className="relative h-40 w-full bg-cream">
        {cover ? (
          <Image
            src={cover}
            alt=""
            fill
            sizes="(max-width:480px) 100vw, 400px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl">🎟️</div>
        )}
        <span className="absolute left-3 top-3 rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-xs font-extrabold lowercase">
          {vibe.category}
        </span>
        {myStatus && STATUS_LABEL[myStatus] && (
          <span className="absolute right-3 top-3 rounded-full border-2 border-ink bg-flockie-orange px-2.5 py-0.5 text-xs font-extrabold text-white">
            {STATUS_LABEL[myStatus]}
          </span>
        )}
        {!myStatus && typeof matchPct === "number" && (
          <span className="absolute right-3 top-3 rounded-full border-2 border-ink bg-flockie-coral px-2.5 py-0.5 text-xs font-extrabold text-white">
            {matchPct}% your vibe
          </span>
        )}
      </div>

      <div className="p-4">
        <p className="text-lg font-extrabold leading-tight">{vibe.title}</p>
        <p className="mt-1 text-sm font-bold text-flockie-orange">
          {formatVibeWhen(vibe.starts_at)}
        </p>
        <p className="mt-1 flex items-center gap-1 text-sm font-medium text-muted">
          <MapPin size={14} /> {vibe.location_name || vibe.city}
        </p>

        {vibe.event_vibe_tags && vibe.event_vibe_tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {vibe.event_vibe_tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-bold text-ink"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
            {hostAvatar ? (
              <Image
                src={hostAvatar}
                alt=""
                width={20}
                height={20}
                className="h-5 w-5 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-flockie-blue text-[10px] font-bold text-white">
                {hostName[0]}
              </span>
            )}
            {hostName}
          </span>
          <span className="flex items-center gap-1 text-sm font-bold text-muted">
            <Users size={14} /> {confirmedCount}/{vibe.capacity}
          </span>
        </div>
      </div>
    </Link>
  );
}
