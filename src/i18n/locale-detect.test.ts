import { describe, it, expect } from "vitest";
import { matchAcceptLanguage, resolveLocale } from "@/i18n/locale-detect";

describe("matchAcceptLanguage", () => {
  it("collapses region subtags to the base language", () => {
    expect(matchAcceptLanguage("pt-BR,pt;q=0.9,en;q=0.8")).toBe("pt");
    expect(matchAcceptLanguage("es-MX,es;q=0.9")).toBe("es");
  });

  it("respects q ordering", () => {
    expect(matchAcceptLanguage("en;q=0.5,pt;q=0.9")).toBe("pt");
  });

  it("skips q=0 entries", () => {
    expect(matchAcceptLanguage("pt;q=0,en;q=0.5")).toBe("en");
    expect(matchAcceptLanguage("pt;q=0")).toBeNull();
  });

  it("ignores unsupported languages and wildcards", () => {
    expect(matchAcceptLanguage("fr-FR,de;q=0.9")).toBeNull();
    expect(matchAcceptLanguage("*")).toBeNull();
    expect(matchAcceptLanguage("fr,pt;q=0.3")).toBe("pt");
  });

  it("is case-insensitive and whitespace-tolerant (proxy-mangled headers)", () => {
    expect(matchAcceptLanguage("PT-br")).toBe("pt");
    expect(matchAcceptLanguage("pt ; q=0.9")).toBe("pt");
    expect(matchAcceptLanguage("pt;Q=0.9")).toBe("pt");
  });

  it("treats a malformed q as 1 instead of dropping the language", () => {
    expect(matchAcceptLanguage("pt;q=abc")).toBe("pt");
  });

  it("handles null/empty headers", () => {
    expect(matchAcceptLanguage(null)).toBeNull();
    expect(matchAcceptLanguage("")).toBeNull();
  });
});

describe("resolveLocale", () => {
  it("explicit cookie choice always wins", () => {
    expect(
      resolveLocale({ cookie: "en", country: "BR", acceptLanguage: "pt-BR" })
    ).toBe("en");
  });

  it("geo-IP beats browser language (Brazilian on an English browser)", () => {
    expect(
      resolveLocale({ cookie: null, country: "BR", acceptLanguage: "en-US,en;q=0.9" })
    ).toBe("pt");
  });

  it("falls back to browser language for unmapped countries (Brazilian abroad)", () => {
    expect(
      resolveLocale({ cookie: null, country: "US", acceptLanguage: "pt-BR,pt;q=0.9" })
    ).toBe("pt");
    // Kazakhstan is unmapped - the VPN case
    expect(
      resolveLocale({ cookie: null, country: "KZ", acceptLanguage: "pt-BR" })
    ).toBe("pt");
  });

  it("country codes are case-insensitive", () => {
    expect(resolveLocale({ cookie: null, country: "br", acceptLanguage: null })).toBe("pt");
  });

  it("Spanish-speaking countries default to es", () => {
    expect(resolveLocale({ cookie: null, country: "MX", acceptLanguage: null })).toBe("es");
  });

  it("defaults to English with no signals", () => {
    expect(resolveLocale({ cookie: null, country: null, acceptLanguage: null })).toBe("en");
    expect(
      resolveLocale({ cookie: "xx", country: "FR", acceptLanguage: "fr-FR" })
    ).toBe("en");
  });
});
