import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import InboxList, { type Notif } from "@/components/InboxList";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 20;

export default async function InboxPage(
  props: {
    searchParams: Promise<{ page?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const user = await getSessionUser();
  const t = await getTranslations("inbox");

  const page = Math.max(1, Number(searchParams.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const [{ data: notifications, count }, { data: dismissed }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, type, title, body, data, read_at, dismissed_at, created_at", { count: "exact" })
      .eq("user_id", user!.id)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1),
    // Recently dismissed - the collapsed archive at the bottom of the list.
    supabase
      .from("notifications")
      .select("id, type, title, body, data, read_at, dismissed_at, created_at")
      .eq("user_id", user!.id)
      .not("dismissed_at", "is", null)
      .order("dismissed_at", { ascending: false })
      .limit(20),
  ]);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const rows = (notifications ?? []) as Notif[];
  const dismissedRows = (dismissed ?? []) as Notif[];
  const allRows = [...rows, ...dismissedRows];

  // Enrich with the specific Vibe / trip names so the localized text can keep them.
  const titles: Record<string, string> = {};
  const vibeIds = Array.from(
    new Set(allRows.map((n) => n.data?.vibe_id).filter((id): id is string => Boolean(id))),
  );
  const tripIds = Array.from(
    new Set(allRows.map((n) => n.data?.trip_id).filter((id): id is string => Boolean(id))),
  );
  const [vibeNames, tripNames, invites] = await Promise.all([
    vibeIds.length
      ? supabase.from("vibes").select("id, title").in("id", vibeIds)
      : Promise.resolve({ data: [] as { id: string; title: string | null }[] }),
    tripIds.length
      ? supabase.from("trips").select("id, destination").in("id", tripIds)
      : Promise.resolve({ data: [] as { id: string; destination: string | null }[] }),
    // Live confirm deadlines for invitation notifications → countdown chips.
    vibeIds.length
      ? supabase
          .from("vibe_interests")
          .select("vibe_id, invitation_expires_at")
          .eq("user_id", user!.id)
          .eq("status", "invited")
          .in("vibe_id", vibeIds)
      : Promise.resolve({ data: [] as { vibe_id: string; invitation_expires_at: string | null }[] }),
  ]);
  for (const v of vibeNames.data ?? []) if (v.title) titles[v.id] = v.title;
  for (const tr of tripNames.data ?? []) if (tr.destination) titles[tr.id] = tr.destination;
  const deadlines: Record<string, string> = {};
  for (const r of invites.data ?? []) if (r.invitation_expires_at) deadlines[r.vibe_id] = r.invitation_expires_at;

  return (
    <main className="px-5 pt-6">
      <h1 className="text-2xl font-black">{t("title")}</h1>
      <div className="mt-5">
        <InboxList
          notifications={rows}
          dismissedNotifications={dismissedRows}
          titles={titles}
          deadlines={deadlines}
        />
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        hrefFor={(p) => (p > 1 ? `/inbox?page=${p}` : "/inbox")}
      />
    </main>
  );
}
