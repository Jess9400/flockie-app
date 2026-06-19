import { NextResponse } from "next/server";

// Reverse-geocode lat/lng → city. Uses Google Geocoding if GEOCODING_KEY is set
// (server-side, unrestricted/IP-restricted key — NOT the referrer-restricted
// NEXT_PUBLIC_GMAPS_KEY), otherwise the free OpenStreetMap Nominatim service.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  if (!lat || !lng || isNaN(+lat) || isNaN(+lng)) {
    return NextResponse.json({ error: "bad coords" }, { status: 400 });
  }

  const key = process.env.GEOCODING_KEY;
  try {
    let city: string | null = null;

    if (key) {
      const r = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=locality|postal_town|administrative_area_level_2&key=${key}`
      );
      const d = await r.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const comps: any[] = d.results?.[0]?.address_components ?? [];
      city =
        comps.find((c) => c.types?.includes("locality"))?.long_name ??
        comps.find((c) => c.types?.includes("postal_town"))?.long_name ??
        comps.find((c) => c.types?.includes("administrative_area_level_2"))?.long_name ??
        null;
    } else {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
        { headers: { "User-Agent": "Flockie/1.0 (hello@findflockie.com)" } }
      );
      const d = await r.json();
      const a = d.address ?? {};
      city = a.city || a.town || a.village || a.municipality || a.county || a.state || null;
    }

    return NextResponse.json({ city }, { headers: { "cache-control": "public, max-age=86400" } });
  } catch {
    return NextResponse.json({ city: null }, { status: 200 });
  }
}
