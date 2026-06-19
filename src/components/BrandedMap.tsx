"use client";

import { useEffect, useRef, useState } from "react";

// Loads the Google Maps JS API once (module-level promise).
let gmapsPromise: Promise<void> | null = null;
function loadGmaps(key: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).google?.maps) return Promise.resolve();
  if (!gmapsPromise) {
    gmapsPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject();
      document.head.appendChild(s);
    });
  }
  return gmapsPromise;
}

const STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f7f3ee" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#0a2545" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f7f3ee" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#4da8da" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "simplified" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#e9e3d8" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#cfe8c8" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

export default function BrandedMap({
  apiKey,
  location,
  fallbackSrc,
}: {
  apiKey: string;
  location: string;
  fallbackSrc: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"loading" | "map" | "fallback">("loading");

  useEffect(() => {
    let active = true;
    loadGmaps(apiKey)
      .then(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = (window as any).google;
        if (!g?.maps || !ref.current) throw new Error("no maps");
        new g.maps.Geocoder().geocode(
          { address: location },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (results: any, status: string) => {
            if (!active) return;
            if (status !== "OK" || !results?.[0]) {
              setMode("fallback");
              return;
            }
            const pos = results[0].geometry.location;
            const map = new g.maps.Map(ref.current, {
              center: pos,
              zoom: 15,
              styles: STYLE,
              disableDefaultUI: true,
              zoomControl: true,
              gestureHandling: "cooperative",
            });
            new g.maps.Marker({
              position: pos,
              map,
              icon: {
                path: "M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z",
                fillColor: "#FF6B4A",
                fillOpacity: 1,
                strokeColor: "#0A2545",
                strokeWeight: 2,
                scale: 1.1,
                anchor: new g.maps.Point(12, 36),
              },
            });
            setMode("map");
          }
        );
      })
      .catch(() => active && setMode("fallback"));
    return () => {
      active = false;
    };
  }, [apiKey, location]);

  if (mode === "fallback") {
    return (
      <iframe
        title="Event location"
        src={fallbackSrc}
        loading="lazy"
        className="h-[250px] w-full rounded-2xl border-2 border-navy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    );
  }

  return (
    <div className="relative h-[250px] w-full overflow-hidden rounded-2xl border-2 border-navy">
      <div ref={ref} className="h-full w-full" />
      {mode === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-cream font-nunito text-sm font-medium text-navy/50">
          Loading map…
        </div>
      )}
    </div>
  );
}
