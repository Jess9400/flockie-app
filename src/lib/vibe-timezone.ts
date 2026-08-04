import tzLookup from "tz-lookup";

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function parseLocalDateTime(value: string): DateTimeParts | null {
  const match = LOCAL_DATE_TIME.exec(value);
  if (!match) return null;

  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }

  return { year, month, day, hour, minute };
}

function dateTimeParts(date: Date, timeZone: string): DateTimeParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function asUtc(parts: DateTimeParts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}

function sameParts(a: DateTimeParts, b: DateTimeParts) {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute
  );
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function eventTimeZoneFromCoordinates(lat: number, lng: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  try {
    return tzLookup(lat, lng);
  } catch {
    return null;
  }
}

export function formatDateTimeInputInTimeZone(date: Date, timeZone: string): string {
  const parts = dateTimeParts(date, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function zonedDateTimeToIso(value: string, timeZone: string): string | null {
  const target = parseLocalDateTime(value);
  if (!target) return null;

  const targetUtc = asUtc(target);
  let instant = targetUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = dateTimeParts(new Date(instant), timeZone);
    const delta = targetUtc - asUtc(observed);
    if (delta === 0) break;
    instant += delta;
  }

  const result = new Date(instant);
  return sameParts(dateTimeParts(result, timeZone), target) ? result.toISOString() : null;
}
