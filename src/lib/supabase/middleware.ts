import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const PUBLIC_PATHS = ["/login", "/auth", "/vouch", "/privacy", "/terms", "/invite", "/compat"];

// Refreshes the Supabase session on every request and gates the app behind
// auth: signed-out users are redirected to /login (except public paths).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // Segment-aware so "/v…" prefixes don't accidentally match (e.g. /vibes).
  const firstSeg = "/" + path.split("/")[1];
  const isPublic = PUBLIC_PATHS.includes(firstSeg);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    const dest = path + (request.nextUrl.search || "");
    url.pathname = "/login";
    url.search = `?redirect=${encodeURIComponent(dest)}`;
    return NextResponse.redirect(url);
  }

  return response;
}
