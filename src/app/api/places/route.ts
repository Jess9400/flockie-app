import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Place suggestions for the "invite / propose a plan" flow. Prefers Google
// Places (New) Text Search when a key is present (the founder's chosen source),
// and falls back to free OpenStreetMap (Nominatim) so tap-to-fill still works
// before the paid NEXT_PUBLIC_GMAPS_KEY is funded. Returns {name, address, url}.

type Place = { name: string; address: string | null; url: string };

// Category → a query hint that steers results toward the right kind of venue.
const CATEGORY_HINT: Record<string, string> = {
  coffee: "coffee shop",
  restaurant: "restaurant",
  bar: "bar",
  park: "park",
  activity: "",
};

const mapsSearch = (q: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const category = searchParams.get("category")?.trim() ?? "";
  const city = searchParams.get("city")?.trim() ?? "";
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  // Auth-gate + rate limit (can hit the paid Google Places API).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("rate_limit_hit", {
    p_bucket: "places",
    p_max: 120,
    p_window_seconds: 3600,
  });
  if (allowed === false)
    return NextResponse.json({ error: "Too many requests — slow down." }, { status: 429 });

  const hint = CATEGORY_HINT[category] ?? "";
  const textQuery = [q, hint, city ? `in ${city}` : ""].filter(Boolean).join(" ");
  const key = process.env.GEOCODING_KEY || process.env.NEXT_PUBLIC_GMAPS_KEY;

  try {
    let results: Place[] = [];

    if (key) {
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.googleMapsUri",
        },
        body: JSON.stringify({ textQuery, maxResultCount: 5 }),
      });
      const data = await res.json();
      if (Array.isArray(data.places)) {
        results = data.places
          .map((p: Record<string, unknown>): Place | null => {
            const name = (p.displayName as { text?: string } | undefined)?.text;
            if (!name) return null;
            return {
              name,
              address: (p.formattedAddress as string) ?? null,
              url: (p.googleMapsUri as string) ?? mapsSearch(`${name} ${city}`),
            };
          })
          .filter(Boolean) as Place[];
      } else if (data.error) {
        console.warn("[places] Google error:", data.error?.status, data.error?.message ?? "");
      }
    }

    // Free fallback: OSM Nominatim. Works with no key (or a referrer-restricted
    // one that denies server calls), so the picker is never dead.
    if (results.length === 0) {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&namedetails=1&q=${encodeURIComponent(
          textQuery
        )}`,
        { headers: { "User-Agent": "Flockie/1.0 (hello@findflockie.com)" } }
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        results = data
          .map((r: Record<string, unknown>): Place | null => {
            const named = (r.namedetails as { name?: string } | undefined)?.name;
            const display = r.display_name as string | undefined;
            const name = named || display?.split(",")[0];
            if (!name) return null;
            return {
              name,
              address: display ?? null,
              url: mapsSearch(display || `${name} ${city}`),
            };
          })
          .filter(Boolean) as Place[];
      }
    }

    return NextResponse.json(
      { results },
      { headers: { "cache-control": "private, max-age=120" } }
    );
  } catch {
    return NextResponse.json({ results: [] });
  }
}
