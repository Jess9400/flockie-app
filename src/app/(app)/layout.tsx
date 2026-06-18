import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";

// Protected shell for the authenticated app. Middleware already gates access;
// this is a second guard + provides the tab bar layout.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="mx-auto min-h-screen max-w-md pb-20">
      {children}
      <BottomNav />
    </div>
  );
}
