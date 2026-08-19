const BLOCKED_REDIRECT_PREFIXES = ["/auth", "/login", "/logout"];

export function safeRedirectPath(
  value: string | null | undefined,
  fallback = "/home"
) {
  if (!value) return fallback;

  try {
    const url = new URL(value, "https://app.findflockie.com");
    if (url.origin !== "https://app.findflockie.com") return fallback;

    const path = `${url.pathname}${url.search}${url.hash}`;
    if (!path.startsWith("/") || path.startsWith("//")) return fallback;
    if (BLOCKED_REDIRECT_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
      return fallback;
    }

    return path;
  } catch {
    return fallback;
  }
}

// Destinations someone reaches because a human invited them by name: a club
// invite link, or a club page a member sent them. These skip the Vibe
// questionnaire. Matching plays no part in club entry - the host already
// chose these people - so four taste questions at the door is friction at the
// moment of highest intent. The soft nudges on Home and Vibes pick the
// questionnaire up later, once they have a reason to care about matching.
export function isInvitedDestination(path?: string | null) {
  const safe = safeRedirectPath(path, "");
  return !!safe && safe.startsWith("/clubs/");
}

export function withReturnTo(path: string, returnTo?: string | null) {
  const safeReturnTo = safeRedirectPath(returnTo, "");
  if (!safeReturnTo) return path;

  const url = new URL(path, "https://app.findflockie.com");
  url.searchParams.set("returnTo", safeReturnTo);
  return `${url.pathname}${url.search}${url.hash}`;
}
