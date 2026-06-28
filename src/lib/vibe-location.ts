export type ApproximateVibeLocation = {
  area?: string | null;
  city?: string | null;
  country?: string | null;
};

export function formatApproximateVibeLocation(location: ApproximateVibeLocation) {
  const seen = new Set<string>();
  return [location.area, location.city, location.country]
    .map((part) => part?.trim())
    .filter((part): part is string => {
      if (!part) return false;
      const key = part.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(", ");
}
