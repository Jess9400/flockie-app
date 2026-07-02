import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Parse any numeric IPv4 literal (dotted decimal, hex 0x7f000001, octal
// 0177.0.0.1, short-form 127.1, single 32-bit decimal) into canonical octets.
// Returns null if the host is not a numeric IPv4 literal (i.e. a normal domain).
function parseIPv4Literal(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length < 1 || parts.length > 4 || parts.some((p) => p === "")) return null;
  const nums: number[] = [];
  for (const p of parts) {
    let n: number;
    if (/^0x[0-9a-f]+$/i.test(p)) n = parseInt(p.slice(2), 16);
    else if (/^0[0-7]*$/.test(p)) n = parseInt(p || "0", 8);
    else if (/^[1-9]\d*$/.test(p)) n = parseInt(p, 10);
    else return null; // not a pure numeric literal → hostname, handled elsewhere
    if (!Number.isSafeInteger(n) || n < 0) return null;
    nums.push(n);
  }
  // In short forms the LAST part covers all remaining bytes (e.g. 127.1 → 127.0.0.1).
  const last = nums.pop() as number;
  const remainingBytes = 4 - nums.length;
  if (nums.some((n) => n > 255) || last >= 2 ** (8 * remainingBytes)) return null;
  const octets = [...nums];
  for (let i = remainingBytes - 1; i >= 0; i--) octets.push((last >>> (8 * i)) & 255);
  return octets;
}

function isPrivateIPv4(octets: number[]): boolean {
  const [a, b] = octets;
  return (
    a === 0 || // "this network"
    a === 10 || // RFC1918
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64/10
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // RFC1918
    (a === 192 && b === 168) || // RFC1918
    (a === 192 && b === 0) || // 192.0.0/24 + 192.0.2/24 test
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast / reserved / broadcast
  );
}

// SSRF guard: only public http(s). Blocks loopback/private/link-local/metadata
// hostnames plus IPv4 literals in hex/octal/decimal/short notation and private
// IPv6 literals. (Not DNS-rebinding-proof; full protection needs resolving the
// host to an IP.)
function isBlockedUrl(url: URL): boolean {
  if (!["http:", "https:"].includes(url.protocol)) return true;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    return true;
  }
  if (host.includes(":")) {
    // IPv6 literal: block loopback/unspecified, ULA fc00::/7, link-local fe80::/10.
    if (host === "::" || host === "::1" || /^(fc|fd|fe[89ab])/i.test(host)) return true;
    // v4-mapped/compat (::ffff:127.0.0.1 or ::ffff:7f00:1) — block the mapped range wholesale.
    if (/(^|:)ffff:/i.test(host)) return true;
    return false;
  }
  const octets = parseIPv4Literal(host);
  if (octets) return isPrivateIPv4(octets);
  return false;
}

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
  if (isBlockedUrl(parsed)) {
    return NextResponse.json({ error: "blocked" }, { status: 400 });
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    // Follow redirects manually (up to 3 hops), re-validating every Location —
    // otherwise a public URL could 302 to http://169.254.169.254 and bypass the
    // blocklist above.
    let current = parsed;
    let res: Response;
    for (let hop = 0; ; hop++) {
      res = await fetch(current.toString(), {
        signal: ctrl.signal,
        redirect: "manual",
        headers: { "user-agent": "FlockieBot/1.0 (+https://findflockie.com)" },
      });
      if (res.status < 300 || res.status >= 400) break;
      const location = res.headers.get("location");
      if (!location || hop >= 3) {
        clearTimeout(t);
        return NextResponse.json({ error: "fetch failed" }, { status: 200 });
      }
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        clearTimeout(t);
        return NextResponse.json({ error: "fetch failed" }, { status: 200 });
      }
      if (isBlockedUrl(next)) {
        clearTimeout(t);
        return NextResponse.json({ error: "blocked" }, { status: 400 });
      }
      current = next;
    }
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
