// Pure locale-detection logic, extracted from request.ts so it can be unit
// tested without pulling in next-intl/server or next/headers.

export const locales = ["en", "es", "pt"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

// Country → locale for first-visit defaults (ISO 3166-1 alpha-2, from Vercel's
// x-vercel-ip-country header; absent on localhost). Portuguese- and
// Spanish-speaking countries only — everywhere else falls through.
export const COUNTRY_LOCALES: Record<string, Locale> = {
  // Portuguese
  BR: "pt", PT: "pt", AO: "pt", MZ: "pt", CV: "pt", GW: "pt", ST: "pt", TL: "pt",
  // Spanish
  ES: "es", MX: "es", AR: "es", CO: "es", PE: "es", VE: "es", CL: "es",
  EC: "es", GT: "es", CU: "es", BO: "es", DO: "es", HN: "es", PY: "es",
  SV: "es", NI: "es", CR: "es", PA: "es", UY: "es", PR: "es", GQ: "es",
};

// Best supported locale from an Accept-Language header ("pt-BR,pt;q=0.9,en;q=0.8"
// → "pt"). Region subtags collapse to the base language; q=0 entries are skipped.
export function matchAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  const ranges = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim().toLowerCase()).find((p) => p.startsWith("q="));
      const qNum = q ? parseFloat(q.slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(qNum) ? qNum : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag, q } of ranges) {
    if (q === 0) continue;
    const base = tag.split("-")[0];
    if ((locales as readonly string[]).includes(base)) return base as Locale;
  }
  return null;
}

// Full first-visit resolution order: explicit cookie choice → geo-IP country →
// browser Accept-Language → English. Geo beats browser language on purpose: a
// Brazilian on an English-language browser should still land in Portuguese.
export function resolveLocale(input: {
  cookie: string | null | undefined;
  country: string | null | undefined;
  acceptLanguage: string | null | undefined;
}): Locale {
  if (input.cookie && (locales as readonly string[]).includes(input.cookie)) {
    return input.cookie as Locale;
  }
  return (
    COUNTRY_LOCALES[input.country?.toUpperCase() ?? ""] ??
    matchAcceptLanguage(input.acceptLanguage ?? null) ??
    defaultLocale
  );
}
