import { geocodeVibeLocation, type GeocodedPlace } from "@/lib/gmaps-geocode";

// Resolve a vibe location to a pin: browser Places first (best at messy venue
// names), then the server /api/geocode route (its own Google/OSM fallback
// chain) when the SDK yields nothing - e.g. NEXT_PUBLIC_GMAPS_KEY absent or
// blocked in the deployed env. Vibe creation now REQUIRES a resolvable pin
// (the event timezone derives from it), so the fallback matters: without it a
// missing browser key would make creating any vibe impossible.
export async function lookupVibePlace(
  name: string,
  cityHint: string
): Promise<GeocodedPlace | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const viaSdk = await geocodeVibeLocation(trimmed, cityHint).catch(() => null);
  if (viaSdk) return viaSdk;
  try {
    const q = cityHint.trim() ? `${trimmed}, ${cityHint}` : trimmed;
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
    if (!res.ok) return null;
    return (await res.json()) as GeocodedPlace;
  } catch {
    return null;
  }
}
