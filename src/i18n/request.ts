import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

// Cookie-based locale (no URL routing). The active locale lives in the
// `NEXT_LOCALE` cookie and is set by the globe LanguageSwitcher. English is the
// default and the fallback for any unknown/missing value.
export const locales = ["en", "es", "pt"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export default getRequestConfig(async () => {
  const cookieValue = (await cookies()).get("NEXT_LOCALE")?.value;
  const locale: Locale =
    cookieValue && (locales as readonly string[]).includes(cookieValue)
      ? (cookieValue as Locale)
      : defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
