import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import ClubMediaGallery, { type ClubMediaItem } from "@/components/ClubMediaGallery";

// Members-only media library for a club. Host + moderators upload; the
// private bucket serves short-lived signed URLs (supabase/club-media.sql).
export default async function ClubMediaPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const t = await getTranslations("clubs.media");

  const { data } = await supabase.rpc("club_detail", { p_club: params.id }).maybeSingle();
  const club = data as { id: string; title: string; is_host: boolean; membership_status: string | null } | null;
  if (!club) redirect("/clubs");
  const isMember = club.is_host || ["founding", "regular"].includes(club.membership_status ?? "");
  if (!isMember) redirect(`/clubs/${params.id}`);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isModerator = false;
  if (!club.is_host) {
    const { data: myRow } = await supabase
      .from("club_memberships")
      .select("role")
      .eq("club_id", club.id)
      .eq("user_id", user?.id ?? "")
      .maybeSingle();
    isModerator = myRow?.role === "moderator";
  }
  const canManage = club.is_host || isModerator;

  const { data: rows } = await supabase
    .from("club_media")
    .select("id, path, kind, title, uploaded_by, created_at, paid_only")
    .eq("club_id", club.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const media = rows ?? [];

  // One batch of short-lived signed URLs; the page is dynamic, so links stay fresh.
  let urlByPath = new Map<string, string>();
  if (media.length) {
    const { data: signed } = await supabase.storage
      .from("club-media")
      .createSignedUrls(media.map((m) => m.path), 3600);
    urlByPath = new Map(
      (signed ?? []).flatMap((s) =>
        s.signedUrl && s.path ? [[s.path, s.signedUrl] as [string, string]] : []
      )
    );
  }

  const items: ClubMediaItem[] = media
    .map((m) => ({
      id: m.id,
      path: m.path,
      kind: m.kind as ClubMediaItem["kind"],
      title: m.title,
      url: urlByPath.get(m.path) ?? null,
      uploadedBy: m.uploaded_by,
      paidOnly: !!(m as { paid_only?: boolean }).paid_only,
    }))
    .filter((m) => m.url !== null);

  return (
    <main className="mx-auto max-w-2xl px-5 pb-10 pt-6">
      <Link
        href={`/clubs/${club.id}`}
        className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink"
      >
        <ChevronLeft size={16} /> {club.title}
      </Link>
      <h1 className="mt-4 text-2xl font-black text-ink">📁 {t("title")}</h1>
      <p className="mt-1 text-sm font-medium text-muted">
        {canManage ? t("subtitleManager") : t("subtitleMember")}
      </p>

      <ClubMediaGallery
        clubId={club.id}
        items={items}
        canManage={canManage}
        isHost={club.is_host}
        userId={user!.id}
      />
    </main>
  );
}
