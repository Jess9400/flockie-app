import { NextResponse } from "next/server";

type GeocodeResult = {
  label: string;
  lat: number;
  lng: number;
  city: string | null;
  area: string | null;
  country: string | null;
};

type GoogleAddressComponent = { long_name?: string; types?: string[] };

function pickGoogleComponent(
  comps: GoogleAddressComponent[] | undefined,
  types: string[]
): string | null {
  if (!comps) return null;
  for (const type of types) {
    const match = comps.find((component) => component.types?.includes(type))?.long_name;
    if (match) return match;
  }
  return null;
}

function pickGoogleCity(
  comps: { long_name?: string; types?: string[] }[] | undefined
): string | null {
  return pickGoogleComponent(comps, [
    "locality",
    "postal_town",
    "administrative_area_level_2",
    "administrative_area_level_1",
  ]);
}

function pickGoogleArea(comps: GoogleAddressComponent[] | undefined): string | null {
  return pickGoogleComponent(comps, [
    "neighborhood",
    "sublocality_level_1",
    "sublocality",
    "administrative_area_level_3",
  ]);
}

function pickNominatimCity(address: Record<string, string> | undefined): string | null {
  if (!address) return null;
  return (
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.county ??
    address.state ??
    null
  );
}

function pickNominatimArea(address: Record<string, string> | undefined): string | null {
  if (!address) return null;
  return (
    address.neighbourhood ??
    address.suburb ??
    address.quarter ??
    address.city_district ??
    address.borough ??
    address.district ??
    null
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "missing query" }, { status: 400 });

  const key = process.env.GEOCODING_KEY;

  try {
    let result: GeocodeResult | null = null;

    if (key) {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${key}`
      );
      const data = await res.json();
      const first = data.results?.[0];
      const loc = first?.geometry?.location;
      if (first?.formatted_address && loc && typeof loc.lat === "number" && typeof loc.lng === "number") {
        result = {
          label: first.formatted_address,
          lat: loc.lat,
          lng: loc.lng,
          city: pickGoogleCity(first.address_components),
          area: pickGoogleArea(first.address_components),
          country: pickGoogleComponent(first.address_components, ["country"]),
        };
      }
    } else {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`,
        { headers: { "User-Agent": "Flockie/1.0 (hello@findflockie.com)" } }
      );
      const data = await res.json();
      const first = data?.[0];
      if (first?.display_name && first?.lat && first?.lon) {
        result = {
          label: first.display_name,
          lat: Number(first.lat),
          lng: Number(first.lon),
          city: pickNominatimCity(first.address),
          area: pickNominatimArea(first.address),
          country: first.address?.country ?? null,
        };
      }
    }

    if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(result, { headers: { "cache-control": "public, max-age=86400" } });
  } catch {
    return NextResponse.json({ error: "geocode failed" }, { status: 500 });
  }
}
