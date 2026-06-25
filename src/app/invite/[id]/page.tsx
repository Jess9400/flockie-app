import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, CalendarClock, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatVibeWhen } from "@/lib/vibes";
import type { Metadata } from "next";

type PublicVibe = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  photos: string[] | null;
  city: string;
  location_name: string | null;
  starts_at: string;
  capacity: number;
  event_vibe_tags: string[] | null;
  status: string;
  host_name: string | null;
  host_photo: string | null;
  confirmed_count: number;
};

async function getVibe(id: string): Promise<PublicVibe | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_vibe", { p_id: id });
  return (data?.[0] as PublicVibe) ?? null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const v = await getVibe(params.id);
  if (!v) return { title: "Vibe · Flockie" };
  return {
    title: `${v.title} · Flockie`,
    description: v.description ?? `Join this Vibe in ${v.city} on Flockie.`,
    openGraph: {
      title: v.title,
      description: v.description ?? `Join this Vibe in ${v.city}.`,
      images: v.photos?.[0] ? [v.photos[0]] : undefined,
    },
  };
}

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { via?: string; code?: string };
}) {
  const viaHost = searchParams.via === "host";
  const hostCode = searchParams.code?.trim() || "";
  const v = await getVibe(params.id);
  if (!v) notFound();

  return (
    <main className="mx-auto min-h-screen w-full max-w-lg px-5 py-8 font-nunito">
      <Link href="https://findflockie.com" className="flex items-center justify-center">
        <Image src="/logo.svg" alt="Flockie" width={130} height={44} className="h-9 w-auto" priority />
      </Link>

      <div className="mt-6 overflow-hidden rounded-3xl border-2 border-navy bg-white shadow-[0_6px_0_0_rgba(10,37,69,1)]">
        <div className="relative aspect-square w-full bg-cream">
          {v.photos?.[0] ? (
            <Image src={v.photos[0]} alt="" fill sizes="512px" className="object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl">🎟️</div>
          )}
          <span className="absolute left-3 top-3 rounded-full border-2 border-navy bg-white px-2.5 py-0.5 text-xs font-extrabold lowercase">
            {v.category}
          </span>
        </div>

        <div className="p-5">
          <p className="font-nunito text-sm font-semibold text-flockie-coral">You&rsquo;re invited to a Vibe</p>
          <h1 className="mt-1 font-fredoka text-3xl font-bold leading-tight text-navy">{v.title}</h1>

          <div className="mt-3 space-y-1.5 font-nunito text-sm font-medium text-navy">
            <p className="flex items-center gap-2"><CalendarClock size={16} className="text-flockie-coral" /> {formatVibeWhen(v.starts_at)}</p>
            <p className="flex items-center gap-2"><MapPin size={16} className="text-flockie-coral" /> {v.location_name ? `${v.location_name}, ${v.city}` : v.city}</p>
            <p className="flex items-center gap-2"><Users size={16} className="text-flockie-coral" /> {v.confirmed_count}/{v.capacity} going</p>
          </div>

          {v.description && (
            <p className="mt-4 whitespace-pre-wrap font-nunito text-[15px] font-normal text-navy/80">{v.description}</p>
          )}

          {(v.event_vibe_tags?.length ?? 0) > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {v.event_vibe_tags!.map((t) => (
                <span key={t} className="rounded-full bg-cream px-3 py-1 font-nunito text-xs font-bold text-navy">{t}</span>
              ))}
            </div>
          )}

          {v.host_name && (
            <p className="mt-4 flex items-center gap-2 font-nunito text-sm font-medium text-navy/70">
              {v.host_photo ? (
                <Image src={v.host_photo} alt="" width={24} height={24} className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-flockie-blue text-[10px] font-bold text-white">
                  {v.host_name[0]}
                </span>
              )}
              Hosted by {v.host_name}
            </p>
          )}

          {v.status === "cancelled" ? (
            <div className="mt-6 rounded-full border-2 border-navy bg-cream py-3.5 text-center font-fredoka text-sm font-semibold text-navy/60">
              Sign-ups for this Vibe are closed.
            </div>
          ) : hostCode ? (
            <Link
              href={`/vibes/${v.id}?code=${encodeURIComponent(hostCode)}`}
              className="mt-6 block rounded-full border-2 border-navy bg-flockie-coral py-3.5 text-center font-fredoka text-base font-semibold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)]"
            >
              Join with host code
            </Link>
          ) : viaHost ? (
            <Link
              href={`/vibes/${v.id}?request=1`}
              className="mt-6 block rounded-full border-2 border-navy bg-flockie-coral py-3.5 text-center font-fredoka text-base font-semibold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)]"
            >
              Request to join
            </Link>
          ) : v.status === "open" ? (
            <Link
              href={`/vibes/${v.id}?interested=1`}
              className="mt-6 block rounded-full border-2 border-navy bg-flockie-coral py-3.5 text-center font-fredoka text-base font-semibold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)]"
            >
              I&rsquo;m interested
            </Link>
          ) : (
            <div className="mt-6 rounded-full border-2 border-navy bg-cream py-3.5 text-center font-fredoka text-sm font-semibold text-navy/60">
              Sign-ups for this Vibe are closed.
            </div>
          )}
          <p className="mt-2 text-center font-nunito text-xs font-medium text-navy/50">
            {hostCode
              ? "You have a host invite code — tap to join one of the host's spots, confirmed instantly."
              : viaHost
                ? "The host invited you directly — a quick vibe check, then they add you to their spots."
                : "Tap interested — a quick vibe check, then the host’s algorithm picks the most compatible people."}
          </p>
        </div>
      </div>
    </main>
  );
}
