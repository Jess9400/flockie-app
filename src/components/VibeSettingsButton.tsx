"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { geocodeVibeLocation, type GeocodedPlace } from "@/lib/gmaps-geocode";

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const DEADLINE_PRESETS = [48, 24, 6];

// Gear button (top-right of the Vibe info) that opens a Manage sheet: edit
// date/time (with relative signup-deadline presets), spots, address, and
// cancel the Vibe.
export default function VibeSettingsButton({
  vibeId,
  startsAt,
  endsAt,
  signupDeadline,
  capacity,
  city,
  area,
  country,
  locationName,
  locationLat,
  locationLng,
  description,
}: {
  vibeId: string;
  startsAt: string;
  endsAt: string | null;
  signupDeadline: string;
  capacity: number;
  city: string;
  area: string | null;
  country: string | null;
  locationName: string | null;
  locationLat: number | null;
  locationLng: number | null;
  description: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations("vibes");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [starts, setStarts] = useState(toLocalInput(startsAt));
  const [ends, setEnds] = useState(toLocalInput(endsAt));
  const [deadline, setDeadline] = useState(toLocalInput(signupDeadline));
  const [spots, setSpots] = useState(capacity);
  const [locName, setLocName] = useState(locationName ?? "");
  const [locCity, setLocCity] = useState(city);
  const [locArea, setLocArea] = useState(area ?? "");
  const [locCountry, setLocCountry] = useState(country ?? "");
  const [locLat, setLocLat] = useState<number | null>(locationLat);
  const [locLng, setLocLng] = useState<number | null>(locationLng);
  const [pinning, setPinning] = useState(false);
  const [pinMsg, setPinMsg] = useState<string | null>(null);
  const [desc, setDesc] = useState(description);

  function setDeadlineBefore(hours: number) {
    if (!starts) return;
    const d = new Date(new Date(starts).getTime() - hours * 3600 * 1000);
    setDeadline(toLocalInput(d.toISOString()));
  }

  async function saveDates() {
    if (!starts) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("update_vibe_when", {
      p_vibe: vibeId,
      p_starts: new Date(starts).toISOString(),
      p_ends: ends ? new Date(ends).toISOString() : null,
      p_deadline: deadline ? new Date(deadline).toISOString() : null,
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setMsg(t("settings.updated"));
    router.refresh();
  }

  async function saveSpots() {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("update_vibe_capacity", {
      p_vibe: vibeId,
      p_capacity: spots,
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setMsg(t("settings.spotsUpdated"));
    router.refresh();
  }

  // Re-pin when the exact location text changed; the old pin is for the old
  // address. Same engine as the create form (Places, browser-side).
  function onLocNameChange(value: string) {
    setLocName(value);
    setLocLat(null);
    setLocLng(null);
    setPinMsg(null);
  }

  // Browser Places first (best at messy venue names); when it yields nothing
  // (e.g. Maps key absent or blocked), the server /api/geocode route takes
  // over - it carries its own Google/OSM fallback chain.
  async function lookupPlace(name: string, cityHint: string): Promise<GeocodedPlace | null> {
    const viaSdk = await geocodeVibeLocation(name, cityHint).catch(() => null);
    if (viaSdk) return viaSdk;
    try {
      const q = cityHint.trim() ? `${name}, ${cityHint}` : name;
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      if (!res.ok) return null;
      return (await res.json()) as GeocodedPlace;
    } catch {
      return null;
    }
  }

  async function findPin() {
    if (!locName.trim()) return;
    setPinning(true);
    setPinMsg(null);
    try {
      const place = await lookupPlace(locName, locCity);
      if (!place) {
        setPinMsg(t("settings.pinNotFound"));
        return;
      }
      setLocLat(place.lat);
      setLocLng(place.lng);
      // City/area/country come from the VENUE, like on creation.
      if (place.city) setLocCity(place.city);
      if (place.area && !locArea.trim()) setLocArea(place.area);
      if (place.country && !locCountry.trim()) setLocCountry(place.country);
      setPinMsg(t("settings.pinFound"));
    } catch {
      setPinMsg(t("settings.pinNotFound"));
    } finally {
      setPinning(false);
    }
  }

  async function saveAddress() {
    if (!locCity.trim()) return;
    setBusy(true);
    setMsg(null);
    // Text edited but never pinned: try a silent geocode so the map link stays
    // right; on failure save without coords (map falls back to the city).
    let lat = locLat;
    let lng = locLng;
    if (lat == null && locName.trim()) {
      const place = await lookupPlace(locName, locCity);
      if (place) {
        lat = place.lat;
        lng = place.lng;
      }
    }
    const { error } = await supabase.rpc("update_vibe_where", {
      p_vibe: vibeId,
      p_location_name: locName.trim() || null,
      p_lat: lat,
      p_lng: lng,
      p_city: locCity.trim(),
      p_area: locArea.trim() || null,
      p_country: locCountry.trim() || null,
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setLocLat(lat);
    setLocLng(lng);
    setMsg(t("settings.addressUpdated"));
    router.refresh();
  }

  async function saveDescription() {
    if (!desc.trim()) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("update_vibe_description", {
      p_vibe: vibeId,
      p_description: desc.trim(),
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setMsg(t("settings.descriptionUpdated"));
    router.refresh();
  }

  async function del() {
    if (!confirm(t("settings.cancelConfirm"))) return;
    setBusy(true);
    const { error } = await supabase.rpc("cancel_vibe", { p_vibe: vibeId });
    setBusy(false);
    if (error) return setMsg(error.message);
    router.push("/vibes");
    router.refresh();
  }

  const fieldCls = "mt-1 w-full rounded-xl border border-ink/25 px-3 py-2 font-medium outline-none";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("settings.manageVibeAria")}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-white text-ink"
      >
        <Settings size={18} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full flex-col rounded-t-3xl border border-ink/15 bg-white sm:max-w-md sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-ink/10 px-5 py-4">
              <button type="button" onClick={() => setOpen(false)} aria-label={t("settings.closeAria")}>
                <X size={22} className="text-ink" />
              </button>
              <p className="font-fredoka text-lg font-bold text-ink">{t("settings.manageVibe")}</p>
              <span className="w-[22px]" />
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
              <label className="block text-sm font-bold">
                {t("settings.starts")}
                <input type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} className={fieldCls} />
              </label>
              <label className="block text-sm font-bold">
                {t("settings.endsOptional")}
                <input type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} className={fieldCls} />
              </label>

              <div>
                <p className="text-sm font-bold">{t("settings.signupDeadline")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DEADLINE_PRESETS.map((hours) => (
                    <button
                      key={hours}
                      type="button"
                      onClick={() => setDeadlineBefore(hours)}
                      className="rounded-full border-2 border-ink/15 bg-white px-3 py-1.5 text-xs font-bold text-ink hover:bg-cream"
                    >
                      {t("settings.deadlineBefore", { hours })}
                    </button>
                  ))}
                </div>
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className={fieldCls}
                />
                <p className="mt-1 text-xs font-medium text-muted">
                  {t("settings.deadlineHelp")}
                </p>
              </div>

              <button
                onClick={saveDates}
                disabled={busy}
                className="w-full rounded-full border border-ink/15 bg-flockie-orange py-2.5 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:opacity-50"
              >
                {t("settings.saveNotify")}
              </button>

              <div className="border-t-2 border-ink/10 pt-4">
                <label className="block text-sm font-bold">
                  {t("settings.spots")}
                  <input
                    type="number"
                    min={2}
                    max={100}
                    value={spots}
                    onChange={(e) => setSpots(Number(e.target.value))}
                    className={fieldCls}
                  />
                </label>
                <p className="mt-1 text-xs font-medium text-muted">{t("settings.spotsHelp")}</p>
                <button
                  onClick={saveSpots}
                  disabled={busy || spots === capacity || spots < 2 || spots > 100}
                  className="mt-2 w-full rounded-full border border-ink/15 bg-white py-2.5 font-bold text-ink shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:opacity-50"
                >
                  {t("settings.saveSpots")}
                </button>
              </div>

              <div className="border-t-2 border-ink/10 pt-4">
                <label className="block text-sm font-bold">
                  {t("settings.description")}
                  <textarea
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    rows={4}
                    maxLength={4000}
                    className={`${fieldCls} resize-y`}
                  />
                </label>
                <button
                  onClick={saveDescription}
                  disabled={busy || !desc.trim() || desc.trim() === description.trim()}
                  className="mt-2 w-full rounded-full border border-ink/15 bg-white py-2.5 font-bold text-ink shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:opacity-50"
                >
                  {t("settings.saveDescription")}
                </button>
              </div>

              <div className="border-t-2 border-ink/10 pt-4">
                <p className="text-sm font-bold">{t("settings.address")}</p>
                <p className="mt-1 text-xs font-medium text-muted">{t("settings.addressHelp")}</p>
                <label className="mt-2 block text-sm font-bold">
                  {t("settings.exactLocation")}
                  <div className="mt-1 flex gap-2">
                    <input
                      value={locName}
                      onChange={(e) => onLocNameChange(e.target.value)}
                      placeholder={t("settings.exactLocationPlaceholder")}
                      className="w-full rounded-xl border border-ink/25 px-3 py-2 font-medium outline-none"
                    />
                    <button
                      type="button"
                      onClick={findPin}
                      disabled={pinning || busy || !locName.trim()}
                      className="shrink-0 rounded-xl border border-ink/15 bg-white px-3 py-2 text-xs font-bold text-ink disabled:opacity-50"
                    >
                      {pinning ? "…" : t("settings.findPin")}
                    </button>
                  </div>
                </label>
                {pinMsg ? (
                  <p className="mt-1 text-xs font-bold text-flockie-blue">{pinMsg}</p>
                ) : (
                  locLat != null && (
                    <p className="mt-1 text-xs font-medium text-muted">{t("settings.pinSet")}</p>
                  )
                )}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="block text-sm font-bold">
                    {t("settings.city")}
                    <input value={locCity} onChange={(e) => setLocCity(e.target.value)} className={fieldCls} />
                  </label>
                  <label className="block text-sm font-bold">
                    {t("settings.area")}
                    <input value={locArea} onChange={(e) => setLocArea(e.target.value)} className={fieldCls} />
                  </label>
                </div>
                <label className="mt-2 block text-sm font-bold">
                  {t("settings.country")}
                  <input value={locCountry} onChange={(e) => setLocCountry(e.target.value)} className={fieldCls} />
                </label>
                <button
                  onClick={saveAddress}
                  disabled={busy || !locCity.trim()}
                  className="mt-2 w-full rounded-full border border-ink/15 bg-white py-2.5 font-bold text-ink shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:opacity-50"
                >
                  {t("settings.saveAddress")}
                </button>
              </div>

              <button
                onClick={del}
                disabled={busy}
                className="w-full rounded-full border border-ink/15 bg-white py-2.5 font-bold text-ink/70"
              >
                {t("settings.deleteVibe")}
              </button>

              {msg && <p className="text-center text-sm font-bold text-flockie-blue">{msg}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
