import { describe, it, expect } from "vitest";
import {
  eventTimeZoneFromCoordinates,
  formatDateTimeInputInTimeZone,
  zonedDateTimeToIso,
} from "@/lib/vibe-timezone";

// The Almaty incident: a Brazil vibe created from a device in Asia/Almaty
// stored the wrong instant and closed sign-ups hours early. These tests pin
// the conversion behavior that prevents it.

describe("zonedDateTimeToIso", () => {
  it("converts event-local wall clock to the right UTC instant (Brazil)", () => {
    // 3pm in Rio (UTC-3, no DST currently) = 18:00 UTC
    expect(zonedDateTimeToIso("2026-08-02T15:00", "America/Sao_Paulo")).toBe(
      "2026-08-02T18:00:00.000Z"
    );
  });

  it("converts Asia/Almaty (UTC+5) correctly", () => {
    expect(zonedDateTimeToIso("2026-08-02T15:00", "Asia/Almaty")).toBe(
      "2026-08-02T10:00:00.000Z"
    );
  });

  it("handles half-hour offsets (Asia/Kolkata, UTC+5:30)", () => {
    expect(zonedDateTimeToIso("2026-01-15T10:00", "Asia/Kolkata")).toBe(
      "2026-01-15T04:30:00.000Z"
    );
  });

  it("handles 45-minute offsets (Asia/Kathmandu, UTC+5:45)", () => {
    expect(zonedDateTimeToIso("2026-01-15T10:00", "Asia/Kathmandu")).toBe(
      "2026-01-15T04:15:00.000Z"
    );
  });

  it("returns null for a wall time inside a DST spring-forward gap", () => {
    // 2026-03-08 02:30 does not exist in New York (clocks jump 02:00 → 03:00)
    expect(zonedDateTimeToIso("2026-03-08T02:30", "America/New_York")).toBeNull();
  });

  it("resolves DST fall-back ambiguity deterministically and round-trips", () => {
    // 2026-11-01 01:30 happens twice in New York; whichever instant is chosen
    // must render back as 01:30.
    const iso = zonedDateTimeToIso("2026-11-01T01:30", "America/New_York");
    expect(iso).not.toBeNull();
    expect(formatDateTimeInputInTimeZone(new Date(iso!), "America/New_York")).toBe(
      "2026-11-01T01:30"
    );
  });

  it("works across year boundaries in extreme zones", () => {
    // Kiritimati is UTC+14: local New Year is still the previous UTC year.
    expect(zonedDateTimeToIso("2027-01-01T00:30", "Pacific/Kiritimati")).toBe(
      "2026-12-31T10:30:00.000Z"
    );
  });

  it("rejects invalid dates and malformed input", () => {
    expect(zonedDateTimeToIso("2026-02-31T10:00", "America/Sao_Paulo")).toBeNull();
    expect(zonedDateTimeToIso("not-a-date", "America/Sao_Paulo")).toBeNull();
    expect(zonedDateTimeToIso("", "America/Sao_Paulo")).toBeNull();
  });

  it("round-trips through formatDateTimeInputInTimeZone in many zones", () => {
    const zones = [
      "America/Sao_Paulo",
      "Asia/Almaty",
      "Europe/Lisbon",
      "America/New_York",
      "Asia/Kolkata",
      "Pacific/Auckland",
      "UTC",
    ];
    for (const tz of zones) {
      const iso = zonedDateTimeToIso("2026-08-15T19:45", tz);
      expect(iso, tz).not.toBeNull();
      expect(formatDateTimeInputInTimeZone(new Date(iso!), tz), tz).toBe("2026-08-15T19:45");
    }
  });
});

describe("formatDateTimeInputInTimeZone", () => {
  it("renders a UTC instant as event-local wall clock", () => {
    const instant = new Date("2026-08-02T18:00:00Z");
    expect(formatDateTimeInputInTimeZone(instant, "America/Sao_Paulo")).toBe("2026-08-02T15:00");
    expect(formatDateTimeInputInTimeZone(instant, "Asia/Almaty")).toBe("2026-08-02T23:00");
  });
});

describe("eventTimeZoneFromCoordinates", () => {
  it("maps venue coordinates to the venue's zone, not the device's", () => {
    // Belford Roxo / Nova Iguaçu, Brazil
    expect(eventTimeZoneFromCoordinates(-22.76, -43.4)).toBe("America/Sao_Paulo");
    // Almaty, Kazakhstan
    expect(eventTimeZoneFromCoordinates(43.24, 76.89)).toBe("Asia/Almaty");
    // Lisbon
    expect(eventTimeZoneFromCoordinates(38.72, -9.14)).toBe("Europe/Lisbon");
  });

  it("returns null for out-of-range or non-finite coordinates", () => {
    expect(eventTimeZoneFromCoordinates(91, 0)).toBeNull();
    expect(eventTimeZoneFromCoordinates(0, 181)).toBeNull();
    expect(eventTimeZoneFromCoordinates(NaN, 0)).toBeNull();
    expect(eventTimeZoneFromCoordinates(Infinity, 0)).toBeNull();
  });
});
