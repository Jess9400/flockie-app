import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

// Cookie-based locale (no URL routing). The active locale lives in the
// `NEXT_LOCALE` cookie and is set by the globe LanguageSwitcher. English is the
// default and the fallback for any unknown/missing value.
export const locales = ["en", "es", "pt"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

// One JSON file per namespace per locale, under `messages/<locale>/<ns>.json`.
// Each app surface OWNS its own namespace file, so translation work parallelizes
// without merge conflicts. Every namespace listed here MUST have a file (even an
// empty `{}`) for all three locales. Add a new surface = add its name here + its
// three files. The dynamic import below has a static prefix/suffix, so webpack
// bundles every `messages/*/*.json` into the server output (no fs, no
// output-file-tracing config needed).
export const NAMESPACES = [
  "nav",
  "common",
  "components",
  "onboarding",
  "home",
  "vibes",
  "match",
  "buddies",
  "profile",
  "settings",
  "trips",
  "flocks",
  "deals",
  "inbox",
  "review",
] as const;

export default getRequestConfig(async () => {
  const cookieValue = (await cookies()).get("NEXT_LOCALE")?.value;
  const locale: Locale =
    cookieValue && (locales as readonly string[]).includes(cookieValue)
      ? (cookieValue as Locale)
      : defaultLocale;

  const entries = await Promise.all(
    NAMESPACES.map(
      async (ns) =>
        [ns, (await import(`../../messages/${locale}/${ns}.json`)).default] as const
    )
  );

  return { locale, messages: Object.fromEntries(entries) };
});
