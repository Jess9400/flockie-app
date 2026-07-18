import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import CompatShareButton from "@/components/CompatShareButton";

type Target = { id: string; name: string | null; photo: string | null };

export default async function CompatPage({ params }: { params: { id: string } }) {
  const tr = await getTranslations("onboarding.compat");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Messaging apps sometimes linkify the share TEXT into the URL path, so params.id
  // can arrive as "<uuid> See how compatible we'd be…". Pull the real UUID out so
  // the lookup still works (and the page doesn't degrade on a mangled shared link).
  const id =
    params.id.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ??
    params.id;

  // A shared link must NEVER hard-404: if compat_target can't resolve (profile
  // gone, RPC unavailable), degrade to a generic invite so the sign-up / match
  // flow still works.
  const { data: t } = await supabase.rpc("compat_target", { p_id: id });
  const target = (t?.[0] as Target) ?? null;
  const name = target?.name ? target.name.split(" ")[0] : tr("friendFallback");

  let inner: React.ReactNode;

  if (!user) {
    inner = (
      <>
        <Link
          href={`/login?redirect=${encodeURIComponent(`/compat/${id}`)}`}
          className="mt-6 block rounded-full border border-ink/15 bg-flockie-coral py-3.5 text-center font-fredoka text-base font-semibold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
        >
          {tr("takeCheck")}
        </Link>
        <p className="mt-2 text-center text-xs font-medium text-white/60">
          {tr("signupHint")}
        </p>
      </>
    );
  } else if (user.id === id) {
    inner = (
      <div className="mt-6 text-center">
        <p className="font-nunito text-sm font-medium text-white/80">
          {tr("ownLink")}
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
          href={`/onboarding/profile?returnTo=${encodeURIComponent(`/compat/${id}`)}`}
          className="mt-6 block rounded-full border border-ink/15 bg-flockie-coral py-3.5 text-center font-fredoka text-base font-semibold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
        >
          {tr("takeCheckReveal")}
        </Link>
      );
    } else {
      const { data: s } = await supabase.rpc("compat_score", { p_other: id });
      const score = (s?.[0]?.score as number | undefined) ?? null;
      const highlights = (s?.[0]?.highlights as string[] | undefined) ?? [];
      inner = (
        <div className="mt-6 text-center">
          <p className="font-fredoka text-6xl font-bold text-flockie-coral">{score ?? "—"}%</p>
          <p className="mt-1 font-nunito text-base font-semibold text-white">
            {score != null && score >= 70
              ? tr("resultGreat", { name })
              : tr("resultCompatible", { name })}
          </p>
          {highlights.length > 0 && (
            <div className="mt-4">
              <p className="font-nunito text-xs font-bold uppercase tracking-wide text-white/55">
                {tr("youBothLove")}
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {highlights.map((h) => (
                  <span key={h} className="rounded-full bg-white/15 px-3 py-1 font-nunito text-xs font-semibold text-white">
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/vibes"
              className="rounded-full border border-ink/15 bg-flockie-coral py-3 text-center font-fredoka text-sm font-semibold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
            >
              {tr("exploreNearby")}
            </Link>
            <div className="flex justify-center">
              <CompatShareButton
                userId={user.id}
                variant="ghost"
                label={tr("compareAnother")}
              />
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
          {target?.photo ? (
            <Image src={target.photo} alt="" width={88} height={88} className="h-22 w-22 rounded-full border-2 border-white object-cover" style={{ height: 88, width: 88 }} />
          ) : (
            <span className="flex h-22 w-22 items-center justify-center rounded-full border-2 border-white bg-flockie-blue text-2xl font-bold text-white" style={{ height: 88, width: 88 }}>
              {name[0]}
            </span>
          )}
          <h1 className="mt-4 text-center font-fredoka text-3xl font-bold leading-tight text-white">
            {tr.rich("heading", {
              name,
              highlight: (chunks) => <span className="text-flockie-coral">{chunks}</span>,
            })}
          </h1>
          <p className="mt-2 text-center font-nunito text-sm font-medium text-white/70">
            {tr("subheading")}
          </p>
        </div>

        {inner}
      </div>
    </main>
  );
}
