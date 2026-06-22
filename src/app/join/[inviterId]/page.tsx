import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ArchetypeBadge from "@/components/ArchetypeBadge";
import { ARCHETYPES } from "@/lib/onboarding/archetypes";
import type { VibeDimension } from "@/lib/onboarding/types";
import { createClient } from "@/lib/supabase/server";

type ReferralTarget = {
  id: string;
  name: string | null;
  photo: string | null;
  city: string | null;
  archetype: string | null;
};

async function getReferralTarget(inviterId: string): Promise<ReferralTarget | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("referral_target", { p_inviter: inviterId });
  return (data?.[0] as ReferralTarget) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: { inviterId: string };
}): Promise<Metadata> {
  const target = await getReferralTarget(params.inviterId);
  const name = target?.name?.split(" ")[0] || "A friend";

  return {
    title: `${name} invited you to Flockie`,
    description: `Join ${name} on Flockie to find people for trips, activities, and local Vibes.`,
    openGraph: {
      title: `${name} invited you to Flockie`,
      description: "Find someone to go with. Anywhere.",
      images: target?.photo ? [target.photo] : undefined,
    },
  };
}

export default async function JoinPage({ params }: { params: { inviterId: string } }) {
  const target = await getReferralTarget(params.inviterId);
  if (!target) notFound();

  const firstName = target.name?.split(" ")[0] || "A friend";
  const archetype = target.archetype
    ? ARCHETYPES[target.archetype as VibeDimension]
    : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0F2A4C] px-5 py-10 font-nunito">
      <div className="w-full max-w-sm">
        <Link href="https://findflockie.com" className="flex justify-center">
          <Image
            src="/logo-mark-white.svg"
            alt="Flockie"
            width={64}
            height={56}
            className="h-14 w-auto"
            priority
          />
        </Link>

        <section className="mt-6 rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-[0_6px_0_0_#FF6B4A]">
          <div className="mx-auto h-24 w-24 overflow-hidden rounded-full border-2 border-ink bg-flockie-blue">
            {target.photo ? (
              <Image
                src={target.photo}
                alt={firstName}
                width={96}
                height={96}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full items-center justify-center text-3xl font-black text-white">
                {firstName[0]}
              </span>
            )}
          </div>

          <p className="mt-4 text-sm font-extrabold uppercase tracking-wide text-flockie-coral">
            A personal invite
          </p>
          <h1 className="mt-1 font-fredoka text-3xl font-bold leading-tight text-navy">
            {firstName} invited you to Flockie
          </h1>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-navy/70">
            Find people for a spontaneous dinner, a weekend trip, or the activity you keep
            meaning to try.
          </p>

          {(target.city || archetype) && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {target.city && (
                <span className="rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-navy">
                  📍 {target.city}
                </span>
              )}
              {archetype && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1 text-xs font-bold text-navy">
                  <ArchetypeBadge archetypeKey={archetype.key} size={24} />
                  {archetype.name}
                </span>
              )}
            </div>
          )}

          <Link
            href={`/join/${target.id}/accept`}
            className="mt-6 block rounded-full border-2 border-ink bg-flockie-coral py-3.5 font-fredoka text-base font-semibold text-white shadow-[0_4px_0_0_#0A2545]"
          >
            Join {firstName} on Flockie
          </Link>
          <p className="mt-3 text-xs font-semibold text-navy/50">
            Sign in with Google, then take a quick vibe check.
          </p>
        </section>
      </div>
    </main>
  );
}
