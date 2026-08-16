import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import AppShell from "@/components/AppShell";
import { isAdminEmail } from "@/lib/admin";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = await getSessionUser();

  if (!user) redirect("/login");

  return (
    <AppShell userId={user.id} isAdmin={isAdminEmail(user.email)}>
      {children}
    </AppShell>
  );
}
