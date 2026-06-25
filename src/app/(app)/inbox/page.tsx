import { createClient } from "@/lib/supabase/server";
import InboxList, { type Notif } from "@/components/InboxList";

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, title, body, data, read_at, dismissed_at, created_at")
    .eq("user_id", user!.id)
    .is("dismissed_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="px-5 pt-6">
      <h1 className="text-2xl font-black">Inbox</h1>
      <p className="mt-1 text-sm font-medium text-muted">
        Invitations, confirmations, and updates.
      </p>
      <div className="mt-6">
        <InboxList notifications={(notifications ?? []) as Notif[]} />
      </div>
    </main>
  );
}
