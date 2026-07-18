import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Place suggestions for the "invite / propose a plan" flow. Prefers Google
// Places (New) Text Search when a key is present (the founder's chosen source),
// and falls back to free OpenStreetMap (Nominatim) so tap-to-fill still works
// before the paid NEXT_PUBLIC_GMAPS_KEY is funded. Returns {name, address, url}.
//
// Crucially we GEOCODE the city to coordinates first and bound the venue search
// to that area — a plain "coffee in Thane" text search on the free tier happily
// returns cafés in York, England. Coordinates + a bounding box keep it local.

type Place = { name: string; address: string | null; url: string };

// Category → a query hint that steers results toward the right kind of venue.
const CATEGORY_HINT: Record<string, string> = {
  coffee: "coffee shop",
  restaurant: "restaurant",
  bar: "bar",
  park: "park",
  activity: "things to do",
};

const NOMINATIM_HEADERS = { "User-Agent": "Flockie/1.0 (hello@findflockie.com)" };
const mapsSearch = (q: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

// ~13 km half-box around the city centre for the OSM bounded search.
const BOX = 0.12;

async function geocodeCity(
  city: string,
  key: string | undefined
): Promise<{ lat: number; lng: number } | null> {
  try {
    if (key) {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          city
        )}&key=${key}`
      );
      const data = await res.json();
      const loc = data.results?.[0]?.geometry?.location;
      if (loc && typeof loc.lat === "number") return { lat: loc.lat, lng: loc.lng };
    }
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(
        city
      )}`,
      { headers: NOMINATIM_HEADERS }
    );
    const data = await res.json();
    const first = data?.[0];
    if (first?.lat && first?.lon) return { lat: Number(first.lat), lng: Number(first.lon) };
  } catch {
    /* fall through */
  }
  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const category = searchParams.get("category")?.trim() ?? "";
  const city = searchParams.get("city")?.trim() ?? "";
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  // Auth-gate + rate limit (can hit the paid Google Places/Geocoding APIs).
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
  const key = process.env.GEOCODING_KEY || process.env.NEXT_PUBLIC_GMAPS_KEY;
  const center = city ? await geocodeCity(city, key) : null;

  try {
    let results: Place[] = [];

    if (key) {
      // Google Places (New): bias to the city centre when we have it, else fall
      // back to including the city name in the query text.
      const body: Record<string, unknown> = {
        textQuery: [q, hint, center ? "" : city ? `in ${city}` : ""].filter(Boolean).join(" "),
        maxResultCount: 5,
      };
      if (center) {
        body.locationBias = {
          circle: { center: { latitude: center.lat, longitude: center.lng }, radius: 15000 },
        };
      }
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.googleMapsUri",
        },
        body: JSON.stringify(body),
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

    // Free fallback: OSM Nominatim, BOUNDED to the city's bounding box so results
    // stay local instead of matching the venue name worldwide.
    if (results.length === 0) {
      const params = new URLSearchParams({
        format: "jsonv2",
        limit: "5",
        addressdetails: "1",
        namedetails: "1",
        q: [q, hint].filter(Boolean).join(" "),
      });
      if (center) {
        // viewbox = left(minLon),top(maxLat),right(maxLon),bottom(minLat)
        params.set(
          "viewbox",
          `${center.lng - BOX},${center.lat + BOX},${center.lng + BOX},${center.lat - BOX}`
        );
        params.set("bounded", "1");
      } else if (city) {
        params.set("q", `${q} ${hint} ${city}`.trim());
      }
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: NOMINATIM_HEADERS,
      });
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
