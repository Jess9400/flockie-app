import Link from "next/link";
import Image from "next/image";
import { Star } from "lucide-react";
import { formatVibeWhen } from "@/lib/vibes";

type VibeEvt = { id: string; title: string; photo: string | null; starts_at: string; role: string; past: boolean };
type TripEvt = {
  id: string;
  destination?: string | null;
  title?: string | null;
  photo: string | null;
  start_date: string;
  end_date: string;
  past: boolean;
  role?: string;
};

type EventsData = {
  is_owner?: boolean;
  vibes?: VibeEvt[];
  flocks?: TripEvt[];
  activities?: TripEvt[];
  trips?: TripEvt[];
};

function Row({
  photo,
  emoji,
  title,
  sub,
  role,
  past,
  href,
  reviewHref,
  reviewLabel = "Review this Vibe",
}: {
  photo: string | null;
  emoji: string;
  title: string;
  sub: string;
  role?: string;
  past: boolean;
  href?: string;
  reviewHref?: string | null;
  reviewLabel?: string;
}) {
  const inner = (
    <>
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border-2 border-ink bg-cream">
        {photo ? (
          <Image src={photo} alt="" fill sizes="44px" className="object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-lg">{emoji}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold text-navy">{title}</p>
        <p className="truncate text-xs font-medium text-muted">{sub}</p>
      </div>
      {role && (
        <span className="shrink-0 rounded-full bg-cream px-2 py-0.5 text-[10px] font-extrabold uppercase text-muted">
          {role}
        </span>
      )}
    </>
  );
  return (
    <div className={`rounded-2xl border-2 border-ink bg-white p-2 ${past ? "opacity-70" : ""}`}>
      {href ? (
        <Link href={href} className="flex items-center gap-2.5">
          {inner}
        </Link>
      ) : (
        <div className="flex items-center gap-2.5">{inner}</div>
      )}
      {reviewHref && (
        <Link
          href={reviewHref}
          className="mt-1.5 flex items-center justify-center gap-1 rounded-full border-2 border-ink bg-flockie-coral py-1.5 text-xs font-bold text-white"
        >
          <Star size={13} /> {reviewLabel}
        </Link>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="text-sm font-extrabold text-navy">{title}</p>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

const dateRange = (a: string, b: string) => (a === b ? a : `${a} → ${b}`);

export default function ProfileEvents({ data, isOwner }: { data: EventsData; isOwner: boolean }) {
  const vibes = data?.vibes ?? [];
  const flocks = data?.flocks ?? [];
  const activities = data?.activities ?? [];
  const trips = data?.trips ?? [];

  if (!vibes.length && !flocks.length && !activities.length && !trips.length) return null;

  return (
    <>
      {vibes.length > 0 && (
        <Section title="Vibes">
          {vibes.map((v, i) => (
            <Row
              key={`${v.id}-${v.role}-${i}`}
              photo={v.photo}
              emoji="🎟️"
              title={v.title}
              sub={formatVibeWhen(v.starts_at)}
              role={v.role === "host" ? "Host" : "Going"}
              past={v.past}
              href={`/vibes/${v.id}`}
              reviewHref={isOwner && v.past ? `/vibes/${v.id}/review` : null}
            />
          ))}
        </Section>
      )}

      {flocks.length > 0 && (
        <Section title="Flocks">
          {flocks.map((f, i) => (
            <Row
              key={`${f.id}-${f.role}-${i}`}
              photo={f.photo}
              emoji="🧳"
              title={f.destination || "Flock"}
              sub={dateRange(f.start_date, f.end_date)}
              role={f.role === "host" ? "Host" : "Going"}
              past={f.past}
              reviewHref={isOwner && f.past ? `/flocks/${f.id}/review` : null}
              reviewLabel="Review your flockmates"
            />
          ))}
        </Section>
      )}

      {isOwner && activities.length > 0 && (
        <Section title="Activities">
          {activities.map((a) => (
            <Row key={a.id} photo={a.photo} emoji="🎯" title={a.title || "Activity"} sub={dateRange(a.start_date, a.end_date)} past={a.past} />
          ))}
        </Section>
      )}

      {isOwner && trips.length > 0 && (
        <Section title="Trips">
          {trips.map((t) => (
            <Row key={t.id} photo={t.photo} emoji="✈️" title={t.destination || "Trip"} sub={dateRange(t.start_date, t.end_date)} past={t.past} />
          ))}
        </Section>
      )}
    </>
  );
}
