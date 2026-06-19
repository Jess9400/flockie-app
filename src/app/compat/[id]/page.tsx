import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CompatShareButton from "@/components/CompatShareButton";

type Target = { id: string; name: string | null; photo: string | null };

export default async function CompatPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: t } = await supabase.rpc("compat_target", { p_id: params.id });
  const target = (t?.[0] as Target) ?? null;
  if (!target) notFound();
  const name = (target.name || "A flockie").split(" ")[0];

  let inner: React.ReactNode;

  if (!user) {
    inner = (
      <>
        <Link
          href={`/login?redirect=${encodeURIComponent(`/compat/${params.id}`)}`}
          className="mt-6 block rounded-full border-2 border-ink bg-flockie-coral py-3.5 text-center font-fredoka text-base font-semibold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)]"
        >
          Take the 60-sec vibe check
        </Link>
        <p className="mt-2 text-center text-xs font-medium text-white/60">
          Sign up with Google, answer a few questions, see your score.
        </p>
      </>
    );
  } else if (user.id === params.id) {
    inner = (
      <div className="mt-6 text-center">
        <p className="font-nunito text-sm font-medium text-white/80">
          This is your own link — share it with friends to see your match %.
        </p>
        <div className="mt-3 flex justify-center">
          <CompatShareButton userId={user.id} />
        </div>
      </div>
    );
  } else {
    const { data: me } = await supabase
      .from("profiles")
      .select("onboarding_complete")
      .eq("id", user.id)
      .maybeSingle();

    if (!me?.onboarding_complete) {
      inner = (
        <Link
          href={`/profile?compat=${params.id}`}
          className="mt-6 block rounded-full border-2 border-ink bg-flockie-coral py-3.5 text-center font-fredoka text-base font-semibold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)]"
        >
          Take the 60-sec vibe check to reveal your score
        </Link>
      );
    } else {
      const { data: s } = await supabase.rpc("compat_score", { p_other: params.id });
      const score = (s?.[0]?.score as number | undefined) ?? null;
      inner = (
        <div className="mt-6 text-center">
          <p className="font-fredoka text-6xl font-bold text-flockie-coral">{score ?? "—"}%</p>
          <p className="mt-1 font-nunito text-base font-semibold text-white">
            You and {name} are {score != null && score >= 70 ? "a great match" : "compatible"} 🎉
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/vibes"
              className="rounded-full border-2 border-ink bg-flockie-coral py-3 text-center font-fredoka text-sm font-semibold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)]"
            >
              Explore Vibes near you
            </Link>
            <div className="flex justify-center">
              <CompatShareButton userId={user.id} variant="ghost" />
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0F2A4C] px-6 py-10 font-nunito">
      <div className="w-full max-w-sm">
        <Link href="https://findflockie.com" className="flex items-center justify-center">
          <Image src="/logo-mark-white.svg" alt="Flockie" width={56} height={48} className="h-12 w-auto" priority />
        </Link>

        <div className="mt-6 flex flex-col items-center">
          {target.photo ? (
            <Image src={target.photo} alt="" width={88} height={88} className="h-22 w-22 rounded-full border-2 border-white object-cover" style={{ height: 88, width: 88 }} />
          ) : (
            <span className="flex h-22 w-22 items-center justify-center rounded-full border-2 border-white bg-flockie-blue text-2xl font-bold text-white" style={{ height: 88, width: 88 }}>
              {name[0]}
            </span>
          )}
          <h1 className="mt-4 text-center font-fredoka text-3xl font-bold leading-tight text-white">
            How compatible are you with <span className="text-flockie-coral">{name}</span>?
          </h1>
          <p className="mt-2 text-center font-nunito text-sm font-medium text-white/70">
            Take Flockie&rsquo;s quick vibe check and find out your travel-buddy match.
          </p>
        </div>

        {inner}
      </div>
    </main>
  );
}
