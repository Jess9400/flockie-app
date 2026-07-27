"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { intlLocale } from "@/lib/date-locale";
import { Hotel, Plane, Ticket, Search, Users, MapPin, Car, LifeBuoy, CalendarCheck } from "lucide-react";

// Travelpayouts affiliate marker (tracks commission on Hotellook / Aviasales).
const MARKER = "544482";
function klookUrl(city: string, query?: string) {
  const q = [query, city.trim()].filter(Boolean).join(" ");
  return q ? `https://www.klook.com/search/?query=${encodeURIComponent(q)}` : "https://www.klook.com/";
}

// Live Travelpayouts programs (project 544482) - tracked smartlinks.
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

// An upcoming Vibe the user is confirmed for - deals context for real plans.
export type VibePlan = {
  id: string;
  title: string;
  city: string;
  when: string; // pre-formatted, vibe-local time
  category?: string | null; // vibe category slug
  categoryLabel?: string | null; // pre-translated display label
};

// Vibe category → Klook search hint, so the deal link lands on relevant
// experiences ("yoga class in Thane") instead of a generic city search.
// Slugs with no marketplace equivalent (coworking, other) fall back to city.
const KLOOK_QUERY: Record<string, string> = {
  surf: "surf lesson",
  yoga: "yoga class",
  hiking: "hiking tour",
  running: "outdoor activities",
  cycling: "bike tour",
  climbing: "climbing",
  dance: "dance class",
  painting: "art workshop",
  photography: "photography tour",
  music: "live music",
  cooking: "cooking class",
  dinner: "dining",
  coffee: "cafe",
  nightlife: "nightlife",
  wellness: "spa massage",
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
  vibePlans = [],
}: {
  defaultCity: string;
  plans?: Plan[];
  vibePlans?: VibePlan[];
}) {
  const t = useTranslations("deals");
  const locale = useLocale();
  // Activities are local-first: default to the user's own city.
  const [actCity, setActCity] = useState(defaultCity ?? "");
  // Stays are travel: start empty, expand the form once a destination is set.
  const [city, setCity] = useState("");
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
      {/* ── For your plans: upcoming confirmed Vibes ─────────────────────── */}
      {vibePlans.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted">
            {t("forYourPlans")}
          </h2>
          {vibePlans.map((v) => {
            const hint = v.category ? KLOOK_QUERY[v.category] : undefined;
            return (
            <div
              key={v.id}
              className="rounded-3xl border border-onboarding-green/40 bg-[#E9F6F1] p-4 shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
            >
              <p className="flex items-center gap-1.5 font-extrabold">
                <CalendarCheck size={15} className="shrink-0 text-onboarding-green" /> {v.title}
              </p>
              <p className="mt-0.5 text-xs font-medium text-muted">
                {[v.when, v.city].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-3 flex gap-2">
                <a
                  href={klookUrl(v.city, hint)}
                  target="_blank"
                  rel="noopener"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-ink/15 bg-white py-2 text-xs font-bold text-ink"
                >
                  <Ticket size={14} />{" "}
                  {hint && v.categoryLabel
                    ? t("vibeDealCtaCat", { category: v.categoryLabel, city: v.city })
                    : t("vibeDealCta", { city: v.city })}
                </a>
                <Link
                  href={`/vibes/${v.id}`}
                  className="flex items-center justify-center rounded-full border border-ink/15 bg-white px-4 py-2 text-xs font-bold text-ink"
                >
                  {t("viewVibe")}
                </Link>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* ── Things to do near you (hero) ─────────────────────────────────── */}
      <div className="rounded-3xl border border-ink/15 bg-white p-5 shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
        <div className="flex items-center gap-2">
          <Ticket size={20} className="text-flockie-orange" />
          <h2 className="text-lg font-extrabold">{t("activitiesHeading")}</h2>
        </div>
        <p className="mt-1 text-sm font-medium text-muted">
          {t("activitiesSubtitle")}
        </p>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-bold">{t("yourCity")}</span>
          <input
            value={actCity}
            onChange={(e) => setActCity(e.target.value)}
            placeholder={t("cityPlaceholder")}
            className="w-full rounded-2xl border border-ink/25 bg-white px-4 py-2.5 font-medium outline-none"
          />
        </label>

        <a
          href={klookUrl(actCity)}
          target="_blank"
          rel="noopener"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-flockie-orange py-3 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
        >
          <Search size={18} /> {actCity.trim() ? t("browseActivitiesIn", { city: actCity.trim() }) : t("browseActivities")}
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
          href={`/vibes/new?city=${encodeURIComponent(actCity.trim())}`}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-white py-3 font-bold text-ink"
        >
          <Users size={18} /> {t("findBuddyActivity")}
        </Link>
      </div>

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

      {/* ── Traveling soon? ──────────────────────────────────────────────── */}
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted">
        {t("travelSection")}
      </h2>

      {/* Stays - the form stays light until a destination is set */}
      <div className="rounded-3xl border border-ink/15 bg-white p-5 shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
        <div className="flex items-center gap-2">
          <Hotel size={20} className="text-flockie-orange" />
          <h2 className="text-lg font-extrabold">{t("staysHeading")}</h2>
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

        {city.trim() && (
          <>
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
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-flockie-orange py-3.5 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
            >
              <Search size={18} /> {t("searchStaysIn", { city: city.trim() })}
            </button>
          </>
        )}
        <a
          href={KKDAY}
          target="_blank"
          rel="noopener"
          className="mt-2 block text-center text-xs font-bold text-flockie-blue underline underline-offset-2"
        >
          {t("browseKKday")}
        </a>
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
