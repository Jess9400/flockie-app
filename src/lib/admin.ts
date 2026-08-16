// Founder/admin accounts: surfaces still under construction (Trips, Flocks)
// stay visible and clickable ONLY for these emails while everyone else sees a
// "Soon" tag. Keep the list tiny and explicit.
export const ADMIN_EMAILS = ["023logistica@gmail.com"];

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
