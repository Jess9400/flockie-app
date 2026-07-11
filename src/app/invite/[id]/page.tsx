import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, CalendarClock, Users } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { formatVibeWhen } from "@/lib/vibes";
import { formatApproximateVibeLocation } from "@/lib/vibe-location";
import type { Metadata } from "next";

type PublicVibe = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  photos: string[] | null;
  city: string;
  area: string | null;
  country: string | null;
  starts_at: string;
  timezone: string | null;
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
  const [t, v, locale] = await Promise.all([getTranslations("components"), getVibe(params.id), getLocale()]);
  if (!v) notFound();
  const viaHost = searchParams.via === "host";
  const hostCode = searchParams.code?.trim() || "";
  // Once matching has run (ranking/finalized) and there's still room, tapping
  // through confirms instantly on the vibe page — so the CTA reads "Join now"
  // to match. (Same-city is enforced server-side there; this public page can't
  // know the viewer's city, so it shows the optimistic label.)
  const directConfirm =
    ["ranking", "finalized"].includes(v.status) &&
    v.confirmed_count < v.capacity &&
    new Date(v.starts_at) > new Date();
  const approximateLocation =
    formatApproximateVibeLocation(v) || t("invite.locationFallback");

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
          <p className="font-nunito text-sm font-semibold text-flockie-coral">{t("invite.eyebrow")}</p>
          <h1 className="mt-1 font-fredoka text-3xl font-bold leading-tight text-navy">{v.title}</h1>

          <div className="mt-3 space-y-1.5 font-nunito text-sm font-medium text-navy">
            <p className="flex items-center gap-2"><CalendarClock size={16} className="text-flockie-coral" /> {formatVibeWhen(v.starts_at, locale, v.timezone)}</p>
            <p className="flex items-center gap-2"><MapPin size={16} className="text-flockie-coral" /> {approximateLocation}</p>
            <p className="flex items-center gap-2"><Users size={16} className="text-flockie-coral" /> {v.confirmed_count}/{v.capacity} {t("invite.going")}</p>
          </div>

          {v.description && (
            <p className="mt-4 whitespace-pre-wrap font-nunito text-[15px] font-normal text-navy/80">{v.description}</p>
          )}

          {(v.event_vibe_tags?.length ?? 0) > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {v.event_vibe_tags!.map((tag) => (
                <span key={tag} className="rounded-full bg-cream px-3 py-1 font-nunito text-xs font-bold text-navy">{tag}</span>
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
              {t("invite.hostedBy", { name: v.host_name })}
            </p>
          )}

          {v.status === "cancelled" ? (
            <div className="mt-6 rounded-full border-2 border-navy bg-cream py-3.5 text-center font-fredoka text-sm font-semibold text-navy/60">
              {t("invite.closed")}
            </div>
          ) : hostCode ? (
            <Link
              href={`/vibes/${v.id}?code=${encodeURIComponent(hostCode)}`}
              className="mt-6 block rounded-full border-2 border-navy bg-flockie-coral py-3.5 text-center font-fredoka text-base font-semibold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)]"
            >
              {t("invite.joinWithCode")}
            </Link>
          ) : viaHost ? (
            <Link
              href={`/vibes/${v.id}?request=1`}
              className="mt-6 block rounded-full border-2 border-navy bg-flockie-coral py-3.5 text-center font-fredoka text-base font-semibold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)]"
            >
              {t("invite.requestToJoin")}
            </Link>
          ) : ["open", "reviewing", "ranking", "finalized"].includes(v.status) &&
            new Date(v.starts_at) > new Date() ? (
            <Link
              href={`/vibes/${v.id}?interested=1`}
              className="mt-6 block rounded-full border-2 border-navy bg-flockie-coral py-3.5 text-center font-fredoka text-base font-semibold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)]"
            >
              {directConfirm ? t("invite.joinNow") : t("invite.interested")}
            </Link>
          ) : (
            <div className="mt-6 rounded-full border-2 border-navy bg-cream py-3.5 text-center font-fredoka text-sm font-semibold text-navy/60">
              {t("invite.closed")}
            </div>
          )}
          <p className="mt-2 text-center font-nunito text-xs font-medium text-navy/50">
            {hostCode
              ? t("invite.helperCode")
              : viaHost
                ? t("invite.helperHost")
                : t("invite.helperPublic")}
          </p>
        </div>
      </div>
    </main>
  );
}
