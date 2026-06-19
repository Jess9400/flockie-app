"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { captureAndStoreLocation } from "@/lib/location";

const KEY = "flockie-location-asked";

export default function LocationPrompt({ trackingEnabled }: { trackingEnabled?: boolean }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;

    // Tracking on → user already consented: capture location silently, no card.
    if (trackingEnabled) {
      captureAndStoreLocation();
      return;
    }

    // Tracking off → ask contextually (once) where location is actually needed.
    let asked: string | null = null;
    try {
      asked = localStorage.getItem(KEY);
    } catch {}
    if (!asked) {
      const t = setTimeout(() => setShow(true), 1200);
      return () => clearTimeout(t);
    }
  }, [trackingEnabled]);

  function dismiss(value: string) {
    try {
      localStorage.setItem(KEY, value);
    } catch {}
    setShow(false);
  }

  async function enable() {
    setBusy(true);
    const ok = await captureAndStoreLocation();
    if (ok) {
      // Remember consent so it stays silent next time.
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({ location_tracking_enabled: true }).eq("id", user.id);
      }
    }
    setBusy(false);
    dismiss(ok ? "granted" : "denied");
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="rounded-3xl border-2 border-ink bg-white p-5 shadow-[0_8px_0_0_rgba(26,26,26,1)]">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-flockie-blue text-white">
            <MapPin size={18} />
          </span>
          <p className="text-lg font-black">Turn on location</p>
        </div>
        <p className="mt-2 text-sm font-medium text-ink/70">
          Share your location so we can show you Vibes and people happening near
          you. You can change this anytime.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => dismiss("dismissed")}
            className="flex-1 rounded-full border-2 border-ink bg-white py-2.5 text-sm font-bold"
          >
            Not now
          </button>
          <button
            onClick={enable}
            disabled={busy}
            className="flex-1 rounded-full border-2 border-ink bg-flockie-orange py-2.5 text-sm font-bold text-white shadow-[0_3px_0_0_#E0512C] disabled:opacity-50"
          >
            {busy ? "…" : "Turn on"}
          </button>
        </div>
      </div>
    </div>
  );
}
