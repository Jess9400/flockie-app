import createNextIntlPlugin from "next-intl/plugin";

// Cookie-based i18n (no URL routing). Locale is resolved in src/i18n/request.ts
// from the NEXT_LOCALE cookie.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDevelopment = process.env.NODE_ENV === "development";
const connectSources = [
  "'self'",
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://www.google-analytics.com",
  "https://www.googletagmanager.com",
  "https://*.googleapis.com",
  "https://vitals.vercel-insights.com",
  "https://va.vercel-scripts.com",
  ...(isDevelopment ? ["ws://localhost:*", "ws://127.0.0.1:*"] : []),
].join(" ");
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' blob: data: https://*.supabase.co https://images.unsplash.com https://*.googleusercontent.com https://*.googleapis.com https://maps.gstatic.com",
  "media-src 'self' blob: https://*.supabase.co",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  // maps.googleapis.com: the Maps JS SDK script tag injected by
  // src/lib/gmaps-geocode.ts (venue pinning) and BrandedMap - without it the
  // CSP silently kills browser-side Places geocoding.
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://va.vercel-scripts.com https://maps.googleapis.com",
  `connect-src ${connectSources}`,
  "frame-src https://maps.google.com",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
