import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

// Cookie-based locale (no URL routing). The active locale lives in the
// `NEXT_LOCALE` cookie and is set by the globe LanguageSwitcher. First-time
// visitors (no cookie yet — e.g. someone opening a shared /invite link) are
// defaulted by where they are (Vercel geo-IP: Brazil → pt, Spanish-speaking
// countries → es), then by their browser's Accept-Language; English is the
// final fallback. The resolution logic lives in locale-detect.ts (pure,
// unit-tested); this file only wires it to the request.
import { resolveLocale, type Locale } from "@/i18n/locale-detect";

export { locales, defaultLocale, type Locale } from "@/i18n/locale-detect";

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
  "activities",
  "myVibes",
  "vibeCheck",
  "clubs",
  "feed",
] as const;

export default getRequestConfig(async () => {
  const h = await headers();
  const locale: Locale = resolveLocale({
    cookie: (await cookies()).get("NEXT_LOCALE")?.value,
    country: h.get("x-vercel-ip-country"),
    acceptLanguage: h.get("accept-language"),
  });

  const entries = await Promise.all(
    NAMESPACES.map(
      async (ns) =>
        [ns, (await import(`../../messages/${locale}/${ns}.json`)).default] as const
    )
  );

  return { locale, messages: Object.fromEntries(entries) };
});
