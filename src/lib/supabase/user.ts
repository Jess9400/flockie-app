import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Deduped auth lookup for server components. getUser() is a network round-trip to
// Supabase Auth (GoTrue) that validates the JWT - not a local cookie read. The
// (app) layout AND the page it renders both need the user, so without dedup that's
// two concurrent auth calls per navigation. React cache() makes it run once per
// request; every server component should use this instead of supabase.auth.getUser().
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
