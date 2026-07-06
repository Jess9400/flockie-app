import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import CookieConsent from "@/components/CookieConsent";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://app.findflockie.com"),
  applicationName: "Flockie",
  title: { default: "Flockie", template: "%s · Flockie" },
  description: "Find your flock. Your next trip needs a +1.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Flockie",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#F7F3EE",
  width: "device-width",
  initialScale: 1,
  // No maximumScale — blocking pinch-zoom fails WCAG 1.4.4 and hurts the
  // small-text screens (11px meta / dense grids) most.
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Locale + messages come from the NEXT_LOCALE cookie (see src/i18n/request.ts).
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={nunito.variable}>
      <body className="font-nunito">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <CookieConsent />
        </NextIntlClientProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
