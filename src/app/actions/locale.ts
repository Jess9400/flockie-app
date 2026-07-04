"use server";

import { createClient } from "@/lib/supabase/server";
import { locales, type Locale } from "@/i18n/request";

// Persist the signed-in user's language onto profiles.locale. This is the
// source of truth for localized transactional emails (which render in the
// RECIPIENT's locale, not the sender's cookie). Degrades gracefully when the
// visitor isn't signed in — the cookie still drives the UI locale.
export async function setUserLocale(locale: string): Promise<void> {
  if (!(locales as readonly string[]).includes(locale)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({ locale: locale as Locale })
    .eq("id", user.id);
}
