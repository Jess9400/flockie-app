import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import { dfLocale } from "@/lib/date-locale";
import PostComposer, { type PostAnchor } from "@/components/PostComposer";

// Share a recap - gathers everything the user was actually part of (vibes
// hosted/attended, clubs, 1:1 activities) as pickable anchors.
export default async function NewPostPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  const t = await getTranslations("feed.composer");
  const locale = await getLocale();
  const fmt = (iso: string | null) =>
    iso ? format(new Date(iso), "MMM d", { locale: dfLocale(locale) }) : "";

  const [{ data: myInterests }, { data: hostedVibes }, { data: myClubs }, { data: myMemberships }, { data: myActs }, { data: joinedActs }] =
    await Promise.all([
      supabase.from("vibe_interests").select("vibe_id").eq("user_id", user!.id).eq("status", "confirmed"),
      supabase
        .from("vibes")
        .select("id, title, city, starts_at")
        .eq("host_id", user!.id)
        .neq("status", "cancelled")
        .order("starts_at", { ascending: false })
        .limit(8),
      supabase.from("clubs").select("id, title, city, status").eq("owner_id", user!.id).neq("status", "closed"),
      supabase
        .from("club_memberships")
        .select("club_id")
        .eq("user_id", user!.id)
        .in("status", ["founding", "regular"]),
      supabase
        .from("trips")
        .select("id, title, destination, start_date")
        .eq("user_id", user!.id)
        .eq("kind", "activity")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("activity_join_requests").select("activity_id").eq("user_id", user!.id).eq("status", "accepted"),
    ]);

  const anchors: PostAnchor[] = [];

  // Vibes I attended (confirmed) - fetch their details.
  const attendedIds = (myInterests ?? []).map((r) => r.vibe_id as string);
  if (attendedIds.length) {
    const { data: av } = await supabase
      .from("vibe_directory")
      .select("id, title, city, starts_at")
      .in("id", attendedIds)
      .order("starts_at", { ascending: false })
      .limit(8);
    av?.forEach((v) =>
      anchors.push({ kind: "vibe", id: v.id, title: v.title, sub: `${t("subVibe")} · ${fmt(v.starts_at)} · ${v.city}` })
    );
  }
  hostedVibes?.forEach((v) => {
    if (!anchors.some((a) => a.id === v.id))
      anchors.push({ kind: "vibe", id: v.id, title: v.title, sub: `${t("subVibeHosted")} · ${fmt(v.starts_at)} · ${v.city}` });
  });

  // Clubs - mine + memberships.
  const memberClubIds = (myMemberships ?? []).map((r) => r.club_id as string);
  const clubIds = Array.from(new Set(memberClubIds));
  const clubRows = [...(myClubs ?? [])];
  const missing = clubIds.filter((id) => !clubRows.some((c) => c.id === id));
  if (missing.length) {
    const { data: mc } = await supabase.rpc("club_directory").then(
      (r) => ({ data: (r.data ?? []).filter((c: { id: string }) => missing.includes(c.id)) }),
      () => ({ data: [] as { id: string; title: string; city: string }[] })
    );
    (mc as { id: string; title: string; city: string }[]).forEach((c) => clubRows.push({ id: c.id, title: c.title, city: c.city, status: "active" }));
  }
  clubRows.forEach((c) => anchors.push({ kind: "club", id: c.id, title: c.title, sub: `${t("subClub")} · ${c.city}` }));

  // 1:1 activities - mine + accepted joins.
  myActs?.forEach((a) =>
    anchors.push({ kind: "activity", id: a.id, title: a.title ?? t("subActivity"), sub: `${t("subActivity")} · ${fmt(a.start_date)} · ${a.destination ?? ""}` })
  );
  const joinedIds = (joinedActs ?? []).map((r) => r.activity_id as string).filter((id) => !anchors.some((a) => a.id === id));
  if (joinedIds.length) {
    const { data: ja } = await supabase
      .from("trips")
      .select("id, title, destination, start_date")
      .in("id", joinedIds)
      .limit(5);
    ja?.forEach((a) =>
      anchors.push({ kind: "activity", id: a.id, title: a.title ?? t("subActivity"), sub: `${t("subActivity")} · ${fmt(a.start_date)} · ${a.destination ?? ""}` })
    );
  }

  return (
    <main className="mx-auto max-w-xl px-5 pb-10 pt-6">
      <Link href="/home" className="mb-2 inline-flex items-center gap-1 text-sm font-bold text-ink/55 hover:text-ink">
        <ArrowLeft size={15} /> {t("back")}
      </Link>
      <h1 className="text-2xl font-black">{t("heading")}</h1>
      <p className="mt-1 text-sm font-medium text-muted">{t("subtitle")}</p>
      <div className="mt-5">
        <PostComposer anchors={anchors.slice(0, 16)} userId={user!.id} />
      </div>
    </main>
  );
}
