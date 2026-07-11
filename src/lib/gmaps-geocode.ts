// Client-side location lookup via the Maps JS SDK. Runs in the BROWSER, so it
// uses the referrer-restricted NEXT_PUBLIC_GMAPS_KEY (which works there) instead
// of the server /api/geocode route (whose calls get REQUEST_DENIED).
//
// Primary: Places Text Search — the SAME forgiving engine as Google Maps search,
// so messy/partial Indian addresses that the strict Geocoding API (and OSM) can't
// resolve still return a match. Falls back to the Geocoder if Places is
// unavailable.

export type GeocodedPlace = {
  label: string;
  lat: number;
  lng: number;
  city: string | null;
  area: string | null;
  country: string | null;
};

let gmapsPromise: Promise<void> | null = null;
function loadGmaps(key: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).google?.maps?.importLibrary) return Promise.resolve();
  if (!gmapsPromise) {
    gmapsPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&loading=async`;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("gmaps load failed"));
      document.head.appendChild(s);
    });
  }
  return gmapsPromise;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickNew(components: any[] | undefined, types: string[]): string | null {
  if (!components) return null;
  for (const t of types) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = components.find((c: any) => c.types?.includes(t));
    if (m) return m.longText ?? m.long_name ?? null;
  }
  return null;
}

// Places Text Search (new Places API) — matches Google Maps search behaviour.
async function viaPlaces(query: string): Promise<GeocodedPlace | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google;
    const { Place } = await g.maps.importLibrary("places");
    const { places } = await Place.searchByText({
      textQuery: query,
      fields: ["location", "formattedAddress", "displayName", "addressComponents"],
      maxResultCount: 1,
    });
    const p = places?.[0];
    if (!p?.location) return null;
    return {
      label: p.formattedAddress ?? p.displayName ?? query,
      lat: p.location.lat(),
      lng: p.location.lng(),
      city: pickNew(p.addressComponents, ["locality", "postal_town", "administrative_area_level_2"]),
      area: pickNew(p.addressComponents, ["neighborhood", "sublocality_level_1", "sublocality"]),
      country: pickNew(p.addressComponents, ["country"]),
    };
  } catch (e) {
    console.error("[geocode] Places searchByText failed:", e);
    return null;
  }
}

// Stricter Geocoder fallback (Geocoding API).
async function viaGeocoder(query: string): Promise<GeocodedPlace | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google;
    const { Geocoder } = await g.maps.importLibrary("geocoding");
    const geocoder = new Geocoder();
    return await new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      geocoder.geocode({ address: query }, (results: any[], status: string) => {
        if (status === "OK" && results?.[0]) {
          const r = results[0];
          const loc = r.geometry.location;
          resolve({
            label: r.formatted_address,
            lat: loc.lat(),
            lng: loc.lng(),
            city: pickNew(r.address_components, ["locality", "postal_town", "administrative_area_level_2"]),
            area: pickNew(r.address_components, ["neighborhood", "sublocality_level_1", "sublocality"]),
            country: pickNew(r.address_components, ["country"]),
          });
        } else {
          console.error("[geocode] Geocoder status:", status);
          resolve(null);
        }
      });
    });
  } catch (e) {
    console.error("[geocode] Geocoder failed:", e);
    return null;
  }
}

export async function geocodeAddress(query: string): Promise<GeocodedPlace | null> {
  const key = process.env.NEXT_PUBLIC_GMAPS_KEY;
  if (!key || !query.trim()) return null;
  try {
    await loadGmaps(key);
  } catch (e) {
    console.error("[geocode] Maps SDK failed to load:", e);
    return null;
  }
  console.log("[geocode] looking up:", query);
  return (await viaPlaces(query)) ?? (await viaGeocoder(query));
}
