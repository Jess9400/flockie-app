import { describe, expect, it } from "vitest";
import { isInvitedDestination, safeRedirectPath } from "./redirects";

describe("isInvitedDestination", () => {
  it("matches club invite links and club pages", () => {
    expect(isInvitedDestination("/clubs/invite/1a2b3c")).toBe(true);
    expect(isInvitedDestination("/clubs/9f8e7d6c?welcome=1")).toBe(true);
  });

  it("does not match discovery or unrelated destinations", () => {
    // /clubs itself is browse, not an invitation.
    expect(isInvitedDestination("/clubs")).toBe(false);
    expect(isInvitedDestination("/home")).toBe(false);
    expect(isInvitedDestination("/vibes/abc")).toBe(false);
    expect(isInvitedDestination(null)).toBe(false);
    expect(isInvitedDestination("")).toBe(false);
  });

  it("refuses off-site destinations, so the skip cannot be forced from outside", () => {
    expect(isInvitedDestination("https://evil.example.com/clubs/x")).toBe(false);
    expect(isInvitedDestination("//evil.example.com/clubs/x")).toBe(false);
    expect(safeRedirectPath("https://evil.example.com/clubs/x")).toBe("/home");
  });
});
