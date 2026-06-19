import { createClient } from "@/lib/supabase/client";

// Captures the device location, stores the point, and (reverse-geocoded) keeps
// the user's home_city current. Resolves true if permission was granted.
export function captureAndStoreLocation(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const supabase = createClient();
          const { latitude: lat, longitude: lng } = pos.coords;
          await supabase.rpc("set_my_location", { p_lng: lng, p_lat: lat });
          const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
          const data = await res.json();
          if (data?.city) {
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (user) {
              await supabase.from("profiles").update({ home_city: data.city }).eq("id", user.id);
            }
          }
        } catch {
          // best-effort
        }
        resolve(true);
      },
      () => resolve(false),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  });
}
