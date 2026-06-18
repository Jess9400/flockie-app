"use client";

import { useState } from "react";
import { Hotel, Plane, Search } from "lucide-react";

// Travelpayouts affiliate marker (tracks commission on Hotellook / Aviasales).
const MARKER = "540997";

export default function DealsSearch({ defaultCity }: { defaultCity: string }) {
  const [city, setCity] = useState(defaultCity ?? "");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);

  function openHotels() {
    if (!city.trim()) return;
    const params = new URLSearchParams({
      marker: MARKER,
      destination: city.trim(),
      adults: String(guests),
      locale: "en",
      currency: "usd",
    });
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    window.open(`https://search.hotellook.com/?${params.toString()}`, "_blank", "noopener");
  }

  function openFlights() {
    const params = new URLSearchParams({ marker: MARKER, locale: "en" });
    window.open(`https://www.aviasales.com/?${params.toString()}`, "_blank", "noopener");
  }

  return (
    <div className="space-y-6">
      {/* Hotel search */}
      <div className="rounded-3xl border-2 border-ink bg-white p-5 shadow-[0_5px_0_0_rgba(26,26,26,1)]">
        <div className="flex items-center gap-2">
          <Hotel size={20} className="text-flockie-orange" />
          <h2 className="text-lg font-extrabold">Stays</h2>
        </div>
        <p className="mt-1 text-sm font-medium text-muted">
          Hand-picked hotel deals for flockies, booked through Flockie.
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

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Check-in</span>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="w-full rounded-2xl border-2 border-ink bg-white px-3 py-2.5 font-medium outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Check-out</span>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full rounded-2xl border-2 border-ink bg-white px-3 py-2.5 font-medium outline-none"
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
          onClick={openHotels}
          disabled={!city.trim()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-flockie-orange py-3.5 font-bold text-white shadow-[0_4px_0_0_#E0512C] disabled:opacity-50"
        >
          <Search size={18} /> Search stays{city.trim() ? ` in ${city.trim()}` : ""}
        </button>
      </div>

      {/* Flights */}
      <div className="rounded-3xl border-2 border-ink bg-flockie-blue p-5 text-white shadow-[0_5px_0_0_rgba(26,26,26,1)]">
        <div className="flex items-center gap-2">
          <Plane size={20} />
          <h2 className="text-lg font-extrabold">Flights</h2>
        </div>
        <p className="mt-1 text-sm font-medium text-white/90">
          Compare flight deals across hundreds of airlines.
        </p>
        <button
          onClick={openFlights}
          className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-white px-5 py-2.5 font-bold text-ink"
        >
          <Search size={16} /> Search flights
        </button>
      </div>

      <p className="text-center text-xs font-medium text-muted">
        Deals powered by Travelpayouts. Booking through Flockie helps support the
        flock.
      </p>
    </div>
  );
}
