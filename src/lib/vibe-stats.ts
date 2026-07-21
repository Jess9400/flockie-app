import { createClient } from "@/lib/supabase/server";

export type VibeDisplayMatch = {
  score: number | null;
  state: "scored" | "new_pick";
};

// Card-only match display for the current user, keyed by Vibe id. Unlike the
// conservative ranking score, this normalizes only across signals that are
// known for both the user and the Vibe. Returns {} gracefully pre-migration.
export async function loadVibeMatch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  vibeIds: string[]
): Promise<Record<string, VibeDisplayMatch>> {
  const out: Record<string, VibeDisplayMatch> = {};
  const ids = Array.from(new Set(vibeIds)).filter(Boolean);
  if (ids.length === 0) return out;
  const { data, error } = await supabase.rpc("vibe_display_match_scores", { p_ids: ids });
  if (error) {
    console.error("[loadVibeMatch] vibe_display_match_scores RPC failed:", error.message);
    return out;
  }
  (data ?? []).forEach((r: { vibe_id: string; score: number | null; state: string }) => {
    if (r.state === "scored" || r.state === "new_pick") {
      out[r.vibe_id] = { score: r.score, state: r.state };
    }
  });
  return out;
}

// Flock (group-trip) match % between the current user and each trip, by trip id.
export async function loadFlockMatch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripIds: string[]
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const ids = Array.from(new Set(tripIds)).filter(Boolean);
  if (ids.length === 0) return out;
  const { data } = await supabase.rpc("flock_match_scores", { p_ids: ids });
  (data ?? []).forEach((r: { trip_id: string; score: number }) => {
    out[r.trip_id] = r.score;
  });
  return out;
}

// Buddy review stats (avg rating + count) for a set of users, keyed by user id.
export async function loadUserRatings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: string[]
): Promise<Record<string, { avg: number; count: number }>> {
  const out: Record<string, { avg: number; count: number }> = {};
  const ids = Array.from(new Set(userIds)).filter(Boolean);
  if (ids.length === 0) return out;
  const { data } = await supabase.from("reviews").select("subject_id, rating").in("subject_id", ids);
  const agg: Record<string, { sum: number; n: number }> = {};
  (data ?? []).forEach((r: { subject_id: string; rating: number }) => {
    const a = (agg[r.subject_id] ??= { sum: 0, n: 0 });
    a.sum += r.rating;
    a.n += 1;
  });
  for (const id in agg) out[id] = { avg: agg[id].sum / agg[id].n, count: agg[id].n };
  return out;
}
