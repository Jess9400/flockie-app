// Shared labels for trip budget/pace (1-5 scales).
export const BUDGET_LABELS = ["Backpacker", "Budget", "Mid-range", "Comfort", "Luxury"] as const;
export const PACE_LABELS = ["Very slow", "Relaxed", "Balanced", "Active", "Non-stop"] as const;

export function tripDays(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  return Math.max(1, Math.round((+new Date(end) - +new Date(start)) / 86400000) + 1);
}
