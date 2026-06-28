import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Lightweight Open Graph scraper for chat link previews.
export async function GET(req: Request) {
  const target = new URL(req.url).searchParams.get("url");
  if (!target) return NextResponse.json({ error: "missing url" }, { status: 400 });

  // Auth-gate + rate limit: this is a server-side URL fetcher (SSRF surface),
  // only used by signed-in users for chat link previews.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("rate_limit_hit", {
    p_bucket: "og",
    p_max: 120,
    p_window_seconds: 3600,
  });
  if (allowed === false) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "bad url" }, { status: 400 });
  }
  // SSRF guard: only public http(s). Block loopback/private/link-local/IPv6/metadata.
  // (Not DNS-rebinding-proof; full protection needs resolving the host to an IP.)
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const blocked =
    !["http:", "https:"].includes(parsed.protocol) ||
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal" ||
    /^(127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) ||
    host === "::1" ||
    /^(fc|fd|fe80)/i.test(host) ||
    /^\d+$/.test(host); // decimal-encoded IP
  if (blocked) {
    return NextResponse.json({ error: "blocked" }, { status: 400 });
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(parsed.toString(), {
      signal: ctrl.signal,
      headers: { "user-agent": "FlockieBot/1.0 (+https://findflockie.com)" },
    });
    clearTimeout(t);
    if (!res.ok) return NextResponse.json({ error: "fetch failed" }, { status: 200 });

    const html = (await res.text()).slice(0, 300_000);
    const meta = (...keys: string[]) => {
      for (const k of keys) {
        const re = new RegExp(
          `<meta[^>]+(?:property|name)=["']${k}["'][^>]+content=["']([^"']+)["']`,
          "i"
        );
        const m = html.match(re) || html.match(
          new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${k}["']`, "i")
        );
        if (m) return m[1];
      }
      return null;
    };

    const title =
      meta("og:title", "twitter:title") ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
      parsed.hostname;
    const image = meta("og:image", "twitter:image", "twitter:image:src");
    const price = meta("product:price:amount", "og:price:amount");
    const currency = meta("product:price:currency", "og:price:currency");
    const siteName = meta("og:site_name") || parsed.hostname;

    return NextResponse.json(
      {
        url: parsed.toString(),
        title: title?.trim() ?? null,
        image: image ?? null,
        price: price ? `${currency ? currency + " " : ""}${price}` : null,
        siteName,
      },
      { headers: { "cache-control": "public, max-age=86400" } }
    );
  } catch {
    return NextResponse.json({ error: "error" }, { status: 200 });
  }
}
