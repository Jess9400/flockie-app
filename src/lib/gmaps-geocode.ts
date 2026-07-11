// Client-side Google geocoding via the Maps JS SDK. Runs in the BROWSER, so it
// uses the referrer-restricted NEXT_PUBLIC_GMAPS_KEY (which works there) instead
// of the server /api/geocode route (whose calls get REQUEST_DENIED by a
// referrer-restricted key). Same engine Google Maps itself uses, so messy Indian
// addresses that OSM can't touch resolve fine.

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
  if ((window as any).google?.maps) return Promise.resolve();
  if (!gmapsPromise) {
    gmapsPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("gmaps load failed"));
      document.head.appendChild(s);
    });
  }
  return gmapsPromise;
}

// Geocode a free-text address to coordinates + address parts. Returns null when
// the SDK can't load or Google finds no match.
export async function geocodeAddress(query: string): Promise<GeocodedPlace | null> {
  const key = process.env.NEXT_PUBLIC_GMAPS_KEY;
  if (!key || !query.trim()) return null;
  try {
    await loadGmaps(key);
  } catch {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = (window as any).google;
  if (!g?.maps?.Geocoder) return null;
  const geocoder = new g.maps.Geocoder();
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    geocoder.geocode({ address: query }, (results: any[], status: string) => {
      if (status === "OK" && results?.[0]) {
        const r = results[0];
        const loc = r.geometry.location;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pick = (types: string[]): string | null => {
          for (const t of types) {
            const m = r.address_components.find((c: any) => c.types.includes(t));
            if (m) return m.long_name;
          }
          return null;
        };
        resolve({
          label: r.formatted_address,
          lat: loc.lat(),
          lng: loc.lng(),
          city: pick(["locality", "postal_town", "administrative_area_level_2"]),
          area: pick(["neighborhood", "sublocality_level_1", "sublocality"]),
          country: pick(["country"]),
        });
      } else {
        resolve(null);
      }
    });
  });
}
