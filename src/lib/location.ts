import { createClient } from "@/lib/supabase/client";

// Captures the device location and stores the precise point (used for distance,
// never shown to others). It also keeps home_city current — but NEVER silently
// overwrites a city the user already set: it auto-fills only when home_city is
// empty, and otherwise asks before changing it. Resolves true if permission was
// granted.
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
          // Always store the precise point — this is what powers "near me".
          await supabase.rpc("set_my_location", { p_lng: lng, p_lat: lat });

          const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
          const data = await res.json();
          const detected = (data?.city ?? "").toString().trim();
          if (detected) {
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (user) {
              const { data: prof } = await supabase
                .from("profiles")
                .select("home_city")
                .eq("id", user.id)
                .maybeSingle();
              const current = (prof?.home_city ?? "").trim();
              const isDifferent = current.toLowerCase() !== detected.toLowerCase();

              // Auto-fill when empty; otherwise confirm before overwriting a city
              // the user deliberately chose (e.g. a destination they're targeting).
              const allowed =
                !current ||
                (isDifferent &&
                  typeof window !== "undefined" &&
                  window.confirm(
                    `We detected you're in ${detected}. Update your home city from ${current} to ${detected}?`
                  ));

              if (allowed && isDifferent) {
                await supabase.from("profiles").update({ home_city: detected }).eq("id", user.id);
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
