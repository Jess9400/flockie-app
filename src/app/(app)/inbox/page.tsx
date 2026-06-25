import { createClient } from "@/lib/supabase/server";
import InboxList, { type Notif } from "@/components/InboxList";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 20;

export default async function InboxPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  return (
    <main className="px-5 pt-6">
      <h1 className="text-2xl font-black">Inbox</h1>
      <p className="mt-1 text-sm font-medium text-muted">
        Invitations, confirmations, and updates.
      </p>
      <div className="mt-6">
        <InboxList notifications={(notifications ?? []) as Notif[]} />
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        hrefFor={(p) => (p > 1 ? `/inbox?page=${p}` : "/inbox")}
      />
    </main>
  );
}
