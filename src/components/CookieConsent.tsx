"use client";

import { useEffect, useState } from "react";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "G-BGV3BR3042";
const STORAGE_KEY = "flockie-app-cookie-consent";

// Inject + initialise Google Analytics. Only ever called after consent.
function loadGoogleAnalytics() {
  if (!GA_ID) return;
  const w = window as unknown as {
    __gaLoaded?: boolean;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  };
  if (w.__gaLoaded) return;
  w.__gaLoaded = true;

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);

  w.dataLayer = w.dataLayer || [];
  function gtag(...args: unknown[]) {
    w.dataLayer!.push(args);
  }
  w.gtag = gtag;
  gtag("js", new Date());
  gtag("config", GA_ID);
}

// Travelpayouts universal/deep-linking script (project 544482, app.findflockie.com).
// Powers affiliate link tracking + deep-linking for the Deals tab. Only ever
// called after consent.
function loadTravelpayouts() {
  const w = window as unknown as { __tpLoaded?: boolean };
  if (w.__tpLoaded) return;
  w.__tpLoaded = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://emrldtp.com/NTQ0NDgy.js?t=544482";
  document.head.appendChild(s);
}

// Everything we load on consent (analytics + affiliate).
function loadConsented() {
  loadGoogleAnalytics();
  loadTravelpayouts();
}

export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!GA_ID) return; // analytics not configured — never show the banner
    let choice: string | null = null;
    try {
      choice = localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage unavailable (private mode / blocked) — show the banner.
    }
    if (choice === "granted") {
      loadConsented();
    } else if (choice !== "denied") {
      setShow(true);
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, "granted");
    } catch {}
    loadConsented();
    setShow(false);
  }

  function decline() {
    try {
      localStorage.setItem(STORAGE_KEY, "denied");
    } catch {}
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-lg rounded-3xl border-2 border-navy bg-white p-5 font-nunito shadow-[0_8px_0_0_rgba(10,37,69,1)] sm:inset-x-0 sm:bottom-5"
    >
      <p className="text-sm font-medium text-navy/80">
        We use cookies for analytics and to power travel-deal partner links. Your call.{" "}
        <a
          href="https://www.findflockie.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-flockie-coral underline underline-offset-2"
        >
          Privacy Policy
        </a>
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={decline}
          className="order-2 rounded-full border-2 border-navy bg-white px-5 py-2 font-fredoka font-semibold text-navy transition-transform hover:scale-105 sm:order-1"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={accept}
          className="order-1 rounded-full border-2 border-navy bg-flockie-coral px-5 py-2 font-fredoka font-semibold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)] transition-transform hover:scale-105 active:translate-y-1 sm:order-2"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
