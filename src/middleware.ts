import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { resolveLocale } from "@/i18n/locale-detect";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  // Stamp the detected language on the very first request and keep it. Geo-IP
  // headers only exist at the edge, so anything outside a page render - the
  // /auth/callback route handler, the locale persisted with a new profile -
  // could otherwise fall back to English for a Brazilian whose browser sends
  // Accept-Language: en. With the cookie set up front, every later request
  // agrees on one locale. An explicit choice in Settings overwrites it.
  if (!request.cookies.get("NEXT_LOCALE")) {
    const locale = resolveLocale({
      cookie: null,
      country: request.headers.get("x-vercel-ip-country"),
      acceptLanguage: request.headers.get("accept-language"),
    });
    response.cookies.set("NEXT_LOCALE", locale, {
      path: "/",
      maxAge: ONE_YEAR,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  // Run on everything except static assets and image optimization.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
