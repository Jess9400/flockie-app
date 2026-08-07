import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import ConvertVibeToClub, { type ConvertAttendee } from "@/components/ConvertVibeToClub";

// "Turn this into a club?" - host-only conversion screen for an ended vibe.
export default async function FromVibePage(props: { params: Promise<{ vibeId: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const user = await getSessionUser();
  const t = await getTranslations("clubs.convert");

  const { data: vibe } = await supabase
    .from("vibes")
    .select("id, host_id, title, city, starts_at, ends_at, club_id, status")
    .eq("id", params.vibeId)
    .maybeSingle();

  const ended = vibe && new Date(vibe.ends_at ?? vibe.starts_at) <= new Date();
  if (!vibe || vibe.host_id !== user!.id || !ended || vibe.club_id) {
    redirect(vibe ? `/vibes/${vibe.id}` : "/vibes");
  }

  // Confirmed attendees = the people who were actually in the room.
  const { data: interests } = await supabase
    .from("vibe_interests")
    .select("user_id")
    .eq("vibe_id", vibe.id)
    .eq("status", "confirmed");
  const ids = (interests ?? []).map((r) => r.user_id).filter((id) => id !== user!.id);
  let attendees: ConvertAttendee[] = [];
  if (ids.length) {
    const { data: profiles } = await supabase
      .from("public_profiles")
      .select("id, display_name, photos")
      .in("id", ids);
    attendees = (profiles ?? []).map((p) => ({
      id: p.id,
      name: p.display_name ?? "Flockie",
      photo: p.photos?.[0] ?? null,
    }));
  }

  return (
    <main className="mx-auto max-w-xl px-5 pb-10 pt-6">
      <Link
        href={`/vibes/${vibe.id}`}
        className="mb-2 inline-flex items-center gap-1 text-sm font-bold text-ink/55 hover:text-ink"
      >
        <ArrowLeft size={15} /> {vibe.title}
      </Link>
      <h1 className="text-2xl font-black">{t("heading")}</h1>
      <p className="mt-1 text-sm font-medium text-muted">{t("subtitle", { title: vibe.title })}</p>
      <div className="mt-5">
        <ConvertVibeToClub vibeId={vibe.id} vibeTitle={vibe.title} attendees={attendees} />
      </div>
    </main>
  );
}
