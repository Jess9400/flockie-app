"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { intlLocale } from "@/lib/date-locale";
import { Hotel, Plane, Ticket, Search, Users, MapPin, Car, LifeBuoy } from "lucide-react";

// Travelpayouts affiliate marker (tracks commission on Hotellook / Aviasales).
const MARKER = "544482";
function klookUrl(city: string) {
  const c = city.trim();
  return c ? `https://www.klook.com/search/?query=${encodeURIComponent(c)}` : "https://www.klook.com/";
}

// Live Travelpayouts programs (project 544482) — tracked smartlinks.
const KKDAY = "https://kkday.tpo.li/iJK8IZev"; // tours, activities + hotels
const ECONOMYBOOKINGS = "https://economybookings.tpo.li/JdOiCIeg"; // car rentals
const AIRHELP = "https://airhelp.tpo.li/2jSsfFpn"; // flight-delay compensation

const TRENDING = ["Lisbon", "Bali", "Dubai", "Bangkok", "Mexico City", "Tokyo"];

export type Plan = {
  id: string;
  label: string;
  city: string;
  checkIn: string;
  checkOut: string;
  guests: number;
};

function hotelsUrl(city: string, checkIn: string, checkOut: string, guests: number) {
  const params = new URLSearchParams({
    marker: MARKER,
    destination: city,
    adults: String(Math.max(1, guests)),
    locale: "en",
    currency: "usd",
  });
  if (checkIn) params.set("checkIn", checkIn);
  if (checkOut) params.set("checkOut", checkOut);
  return `https://search.hotellook.com/?${params.toString()}`;
}

function open(url: string) {
  window.open(url, "_blank", "noopener");
}

export default function DealsSearch({
  defaultCity,
  plans = [],
}: {
  defaultCity: string;
  plans?: Plan[];
}) {
  const t = useTranslations("deals");
  const locale = useLocale();
  const [city, setCity] = useState(defaultCity ?? "");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);

  function fmtDates(a: string, b: string) {
    if (!a) return "";
    const f = (d: string) =>
      new Date(d).toLocaleDateString(intlLocale(locale), { day: "numeric", month: "short" });
    return b ? `${f(a)} – ${f(b)}` : f(a);
  }

  return (
    <div className="space-y-6">
      {/* ── Deals for your upcoming trips (context-aware) ───────────────── */}
      {plans.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted">
            {t("forUpcomingTrips")}
          </h2>
          {plans.map((p) => (
            <div
              key={p.id}
              className="rounded-3xl border border-ink/15 bg-white p-4 shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
            >
              <p className="flex items-center gap-1.5 font-extrabold">
                <MapPin size={15} className="shrink-0 text-flockie-orange" /> {p.label}
              </p>
              <p className="mt-0.5 text-xs font-medium text-muted">
                {[fmtDates(p.checkIn, p.checkOut), t("travelers", { count: p.guests })]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  onClick={() => open(hotelsUrl(p.city, p.checkIn, p.checkOut, p.guests))}
                  className="flex flex-col items-center gap-1 rounded-2xl border border-ink/15 bg-flockie-orange py-2.5 text-xs font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
                >
                  <Hotel size={16} /> {t("stays")}
                </button>
                <a
                  href={klookUrl(p.city)}
                  target="_blank"
                  rel="noopener"
                  className="flex flex-col items-center gap-1 rounded-2xl border border-ink/15 bg-white py-2.5 text-xs font-bold text-ink"
                >
                  <Ticket size={16} /> {t("activities")}
                </a>
                <button
                  onClick={() => open(`https://www.aviasales.com/?marker=${MARKER}&locale=en`)}
                  className="flex flex-col items-center gap-1 rounded-2xl border border-ink/15 bg-white py-2.5 text-xs font-bold text-ink"
                >
                  <Plane size={16} /> {t("flights")}
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] font-medium text-muted">
                {t("splitStay", { count: p.guests })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Search anywhere ─────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-ink/15 bg-white p-5 shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
        <div className="flex items-center gap-2">
          <Hotel size={20} className="text-flockie-orange" />
          <h2 className="text-lg font-extrabold">{plans.length > 0 ? t("searchAnywhere") : t("staysHeading")}</h2>
        </div>
        <p className="mt-1 text-sm font-medium text-muted">
          {t("staysSubtitle")}
        </p>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-bold">{t("whereTo")}</span>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={t("cityPlaceholder")}
            className="w-full rounded-2xl border border-ink/25 bg-white px-4 py-2.5 font-medium outline-none"
          />
        </label>

        {!city.trim() && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TRENDING.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setCity(t)}
                className="rounded-full border border-ink/15 bg-cream px-3 py-1 text-xs font-bold text-ink"
              >
                {t}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">{t("checkIn")}</span>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="block w-full min-w-0 appearance-none rounded-2xl border border-ink/25 bg-white px-3 py-2.5 font-medium outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">{t("checkOut")}</span>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="block w-full min-w-0 appearance-none rounded-2xl border border-ink/25 bg-white px-3 py-2.5 font-medium outline-none"
            />
          </label>
        </div>

        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-bold">{t("guests", { count: guests })}</span>
          <input
            type="range"
            min={1}
            max={8}
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="w-full accent-flockie-orange"
          />
        </label>

        <button
          onClick={() => open(hotelsUrl(city.trim(), checkIn, checkOut, guests))}
          disabled={!city.trim()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-flockie-orange py-3.5 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:opacity-50"
        >
          <Search size={18} /> {city.trim() ? t("searchStaysIn", { city: city.trim() }) : t("searchStays")}
        </button>
        <a
          href={KKDAY}
          target="_blank"
          rel="noopener"
          className="mt-2 block text-center text-xs font-bold text-flockie-blue underline underline-offset-2"
        >
          {t("browseKKday")}
        </a>
      </div>

      {/* ── Activities ──────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-ink/15 bg-white p-5 shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
        <div className="flex items-center gap-2">
          <Ticket size={20} className="text-flockie-orange" />
          <h2 className="text-lg font-extrabold">{t("activitiesHeading")}</h2>
        </div>
        <p className="mt-1 text-sm font-medium text-muted">
          {t("activitiesSubtitle")}
        </p>
        <a
          href={klookUrl(city)}
          target="_blank"
          rel="noopener"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-flockie-orange py-3 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
        >
          <Search size={18} /> {city.trim() ? t("browseActivitiesIn", { city: city.trim() }) : t("browseActivities")}
        </a>
        <a
          href={KKDAY}
          target="_blank"
          rel="noopener"
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-white py-3 font-bold text-ink"
        >
          <Ticket size={18} /> {t("toursKKday")}
        </a>
        <Link
          href={`/vibes/new?city=${encodeURIComponent(city.trim())}`}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-white py-3 font-bold text-ink"
        >
          <Users size={18} /> {t("findBuddyActivity")}
        </Link>
      </div>

      {/* ── Flights ─────────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-ink/15 bg-flockie-blue p-5 text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
        <div className="flex items-center gap-2">
          <Plane size={20} />
          <h2 className="text-lg font-extrabold">{t("flightsHeading")}</h2>
        </div>
        <p className="mt-1 text-sm font-medium text-white/90">
          {t("flightsSubtitle")}
        </p>
        <button
          onClick={() => open(`https://www.aviasales.com/?marker=${MARKER}&locale=en`)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-white py-2.5 font-bold text-ink"
        >
          <Search size={16} /> {t("searchFlights")}
        </button>
        <a
          href={AIRHELP}
          target="_blank"
          rel="noopener"
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2.5 text-center font-bold text-ink"
        >
          <LifeBuoy size={16} className="shrink-0" />
          <span>{t("checkCompensation")}</span>
        </a>
        <p className="mt-1.5 text-center text-[11px] font-medium text-white/80">
          {t("viaAirHelp")}
        </p>
      </div>

      {/* ── Car rentals ─────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-ink/15 bg-white p-5 shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
        <div className="flex items-center gap-2">
          <Car size={20} className="text-flockie-orange" />
          <h2 className="text-lg font-extrabold">{t("carRentals")}</h2>
        </div>
        <p className="mt-1 text-sm font-medium text-muted">
          {t("carRentalsSubtitle")}
        </p>
        <a
          href={ECONOMYBOOKINGS}
          target="_blank"
          rel="noopener"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-flockie-orange py-3 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
        >
          <Car size={18} /> {t("findRental")}
        </a>
      </div>

      <p className="text-center text-xs font-medium text-muted">
        {t("affiliateNote")}
      </p>
    </div>
  );
}
