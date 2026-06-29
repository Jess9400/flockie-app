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
              // Only seed home_city from GPS if the user hasn't chosen one yet.
              // Never overwrite a chosen city: matching is based on the city you
              // pick (profile, or when you create an activity/vibe) — not wherever
              // your phone happens to be. (e.g. in Thane, looking for a buddy in Dubai.)
              const { data: prof } = await supabase
                .from("profiles")
                .select("home_city")
                .eq("id", user.id)
                .maybeSingle();
              if (!prof?.home_city) {
                await supabase.from("profiles").update({ home_city: data.city }).eq("id", user.id);
              }
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
