import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

// Cookie-based locale (no URL routing). The active locale lives in the
// `NEXT_LOCALE` cookie and is set by the globe LanguageSwitcher. First-time
// visitors (no cookie yet — e.g. someone opening a shared /invite link) get
// their browser's language via Accept-Language; English is the final fallback.
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
  "activities",
  "myVibes",
  "vibeCheck",
  "clubs",
  "feed",
] as const;

// Best supported locale from an Accept-Language header ("pt-BR,pt;q=0.9,en;q=0.8"
// → "pt"). Region subtags collapse to the base language; q=0 entries are skipped.
function matchAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  const ranges = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag: tag.toLowerCase(), q: q ? parseFloat(q.slice(2)) || 0 : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag, q } of ranges) {
    if (q === 0) continue;
    const base = tag.split("-")[0];
    if ((locales as readonly string[]).includes(base)) return base as Locale;
  }
  return null;
}

export default getRequestConfig(async () => {
  const cookieValue = (await cookies()).get("NEXT_LOCALE")?.value;
  const locale: Locale =
    cookieValue && (locales as readonly string[]).includes(cookieValue)
      ? (cookieValue as Locale)
      : (matchAcceptLanguage((await headers()).get("accept-language")) ??
        defaultLocale);

  const entries = await Promise.all(
    NAMESPACES.map(
      async (ns) =>
        [ns, (await import(`../../messages/${locale}/${ns}.json`)).default] as const
    )
  );

  return { locale, messages: Object.fromEntries(entries) };
});
