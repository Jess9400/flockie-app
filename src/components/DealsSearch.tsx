"use client";

import { useState } from "react";
import Link from "next/link";
import { Hotel, Plane, Ticket, Search, Users, MapPin, Car, LifeBuoy } from "lucide-react";

// Travelpayouts affiliate marker (tracks commission on Hotellook / Aviasales).
const MARKER = "544482";
// Klook activity search by city. With Travelpayouts "Drive" active, outbound Klook
// links are auto-attributed — so we link to the real (city-relevant) Klook search
// as an <a> (Drive intercepts anchor clicks, not window.open).
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
  const [city, setCity] = useState(defaultCity ?? "");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);

  function fmtDates(a: string, b: string) {
    if (!a) return "";
    const f = (d: string) =>
      new Date(d).toLocaleDateString("en", { day: "numeric", month: "short" });
    return b ? `${f(a)} – ${f(b)}` : f(a);
  }

  return (
    <div className="space-y-6">
      {/* ── Deals for your upcoming trips (context-aware) ───────────────── */}
      {plans.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted">
            For your upcoming trips
          </h2>
          {plans.map((p) => (
            <div
              key={p.id}
              className="rounded-3xl border-2 border-ink bg-white p-4 shadow-[0_4px_0_0_rgba(26,26,26,1)]"
            >
              <p className="flex items-center gap-1.5 font-extrabold">
                <MapPin size={15} className="shrink-0 text-flockie-orange" /> {p.label}
              </p>
              <p className="mt-0.5 text-xs font-medium text-muted">
                {[fmtDates(p.checkIn, p.checkOut), `${p.guests} ${p.guests === 1 ? "traveler" : "travelers"}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  onClick={() => open(hotelsUrl(p.city, p.checkIn, p.checkOut, p.guests))}
                  className="flex flex-col items-center gap-1 rounded-2xl border-2 border-ink bg-flockie-orange py-2.5 text-xs font-bold text-white shadow-[0_3px_0_0_#E0512C]"
                >
                  <Hotel size={16} /> Stays
                </button>
                <a
                  href={klookUrl(p.city)}
                  target="_blank"
                  rel="noopener"
                  className="flex flex-col items-center gap-1 rounded-2xl border-2 border-ink bg-white py-2.5 text-xs font-bold text-ink"
                >
                  <Ticket size={16} /> Activities
                </a>
                <button
                  onClick={() => open(`https://www.aviasales.com/?marker=${MARKER}&locale=en`)}
                  className="flex flex-col items-center gap-1 rounded-2xl border-2 border-ink bg-white py-2.5 text-xs font-bold text-ink"
                >
                  <Plane size={16} /> Flights
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] font-medium text-muted">
                Split a stay with your flock — pre-filled for {p.guests} travelers.
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Search anywhere ─────────────────────────────────────────────── */}
      <div className="rounded-3xl border-2 border-ink bg-white p-5 shadow-[0_5px_0_0_rgba(26,26,26,1)]">
        <div className="flex items-center gap-2">
          <Hotel size={20} className="text-flockie-orange" />
          <h2 className="text-lg font-extrabold">{plans.length > 0 ? "Search anywhere" : "Stays"}</h2>
        </div>
        <p className="mt-1 text-sm font-medium text-muted">
          Hotel deals booked through Flockie.
        </p>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-bold">Where to?</span>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className="w-full rounded-2xl border-2 border-ink bg-white px-4 py-2.5 font-medium outline-none"
          />
        </label>

        {!city.trim() && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TRENDING.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setCity(t)}
                className="rounded-full border-2 border-ink bg-cream px-3 py-1 text-xs font-bold text-ink"
              >
                {t}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Check-in</span>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="block w-full min-w-0 appearance-none rounded-2xl border-2 border-ink bg-white px-3 py-2.5 font-medium outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Check-out</span>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="block w-full min-w-0 appearance-none rounded-2xl border-2 border-ink bg-white px-3 py-2.5 font-medium outline-none"
            />
          </label>
        </div>

        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-bold">Guests: {guests}</span>
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
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-flockie-orange py-3.5 font-bold text-white shadow-[0_4px_0_0_#E0512C] disabled:opacity-50"
        >
          <Search size={18} /> Search stays{city.trim() ? ` in ${city.trim()}` : ""}
        </button>
        <a
          href={KKDAY}
          target="_blank"
          rel="noopener"
          className="mt-2 block text-center text-xs font-bold text-flockie-blue underline underline-offset-2"
        >
          Or browse stays &amp; tours on KKday →
        </a>
      </div>

      {/* ── Activities ──────────────────────────────────────────────────── */}
      <div className="rounded-3xl border-2 border-ink bg-white p-5 shadow-[0_5px_0_0_rgba(26,26,26,1)]">
        <div className="flex items-center gap-2">
          <Ticket size={20} className="text-flockie-orange" />
          <h2 className="text-lg font-extrabold">Activities</h2>
        </div>
        <p className="mt-1 text-sm font-medium text-muted">
          Tours and experiences via Klook. Find one, then match with someone to do it together.
        </p>
        <a
          href={klookUrl(city)}
          target="_blank"
          rel="noopener"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-flockie-orange py-3 font-bold text-white shadow-[0_4px_0_0_#E0512C]"
        >
          <Search size={18} /> Browse activities{city.trim() ? ` in ${city.trim()}` : " on Klook"}
        </a>
        <a
          href={KKDAY}
          target="_blank"
          rel="noopener"
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-white py-3 font-bold text-ink"
        >
          <Ticket size={18} /> Tours &amp; experiences on KKday
        </a>
        <Link
          href={`/vibes/new?city=${encodeURIComponent(city.trim())}`}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-white py-3 font-bold text-ink"
        >
          <Users size={18} /> Find a buddy for an activity
        </Link>
      </div>

      {/* ── Flights ─────────────────────────────────────────────────────── */}
      <div className="rounded-3xl border-2 border-ink bg-flockie-blue p-5 text-white shadow-[0_5px_0_0_rgba(26,26,26,1)]">
        <div className="flex items-center gap-2">
          <Plane size={20} />
          <h2 className="text-lg font-extrabold">Flights</h2>
        </div>
        <p className="mt-1 text-sm font-medium text-white/90">
          Compare flight deals across hundreds of airlines.
        </p>
        <button
          onClick={() => open(`https://www.aviasales.com/?marker=${MARKER}&locale=en`)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-white py-2.5 font-bold text-ink"
        >
          <Search size={16} /> Search flights
        </button>
        <a
          href={AIRHELP}
          target="_blank"
          rel="noopener"
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-white py-2.5 font-bold text-ink"
        >
          <LifeBuoy size={16} /> Flights &amp; delay compensation — AirHelp
        </a>
      </div>

      {/* ── Car rentals ─────────────────────────────────────────────────── */}
      <div className="rounded-3xl border-2 border-ink bg-white p-5 shadow-[0_5px_0_0_rgba(26,26,26,1)]">
        <div className="flex items-center gap-2">
          <Car size={20} className="text-flockie-orange" />
          <h2 className="text-lg font-extrabold">Car rentals</h2>
        </div>
        <p className="mt-1 text-sm font-medium text-muted">
          Rent a car for your trip — compare deals worldwide.
        </p>
        <a
          href={ECONOMYBOOKINGS}
          target="_blank"
          rel="noopener"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-flockie-orange py-3 font-bold text-white shadow-[0_4px_0_0_#E0512C]"
        >
          <Car size={18} /> Find a rental car
        </a>
      </div>

      <p className="text-center text-xs font-medium text-muted">
        Deals powered by Travelpayouts. Booking through Flockie helps support the flock.
      </p>
    </div>
  );
}
