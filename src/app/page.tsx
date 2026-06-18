import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Entry point: send signed-in users into the app, others to login.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/match" : "/login");
}
