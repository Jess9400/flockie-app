import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import InboxList, { type Notif } from "@/components/InboxList";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 20;

export default async function InboxPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const supabase = await createClient();
  const user = await getSessionUser();
  const t = await getTranslations("inbox");

  const page = Math.max(1, Number(searchParams.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const { data: notifications, count } = await supabase
    .from("notifications")
    .select("id, type, title, body, data, read_at, dismissed_at, created_at", { count: "exact" })
    .eq("user_id", user!.id)
    .is("dismissed_at", null)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  // Enrich with the specific Vibe / trip names so the localized text can keep them.
  const rows = (notifications ?? []) as Notif[];
  const titles: Record<string, string> = {};
  const vibeIds = Array.from(
    new Set(rows.map((n) => n.data?.vibe_id).filter((id): id is string => Boolean(id))),
  );
  const tripIds = Array.from(
    new Set(rows.map((n) => n.data?.trip_id).filter((id): id is string => Boolean(id))),
  );
  const [vibeNames, tripNames] = await Promise.all([
    vibeIds.length
      ? supabase.from("vibes").select("id, title").in("id", vibeIds)
      : Promise.resolve({ data: [] as { id: string; title: string | null }[] }),
    tripIds.length
      ? supabase.from("trips").select("id, destination").in("id", tripIds)
      : Promise.resolve({ data: [] as { id: string; destination: string | null }[] }),
  ]);
  for (const v of vibeNames.data ?? []) if (v.title) titles[v.id] = v.title;
  for (const t of tripNames.data ?? []) if (t.destination) titles[t.id] = t.destination;

  return (
    <main className="px-5 pt-6">
      <h1 className="text-2xl font-black">{t("title")}</h1>
      <p className="mt-1 text-sm font-medium text-muted">
        {t("subtitle")}
      </p>
      <div className="mt-6">
        <InboxList notifications={rows} titles={titles} />
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        hrefFor={(p) => (p > 1 ? `/inbox?page=${p}` : "/inbox")}
      />
    </main>
  );
}
