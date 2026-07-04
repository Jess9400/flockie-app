import createNextIntlPlugin from "next-intl/plugin";

// Cookie-based i18n (no URL routing). Locale is resolved in src/i18n/request.ts
// from the NEXT_LOCALE cookie.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default withNextIntl(nextConfig);
