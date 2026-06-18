import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Flockie",
    short_name: "Flockie",
    description: "Find your flock. Your next trip needs a +1.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A2545",
    theme_color: "#F7F3EE",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
