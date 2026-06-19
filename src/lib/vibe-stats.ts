import { createClient } from "@/lib/supabase/server";

type Stat = { pct: number; count: number };

// Host track record (recommend % across their reviewed Vibes), keyed by host id.
// Returns {} gracefully if the vibe_reviews migration isn't applied yet.
export async function loadHostRecommend(
  supabase: Awaited<ReturnType<typeof createClient>>,
  hostIds: string[]
): Promise<Record<string, Stat>> {
  const out: Record<string, Stat> = {};
  const ids = Array.from(new Set(hostIds)).filter(Boolean);
  if (ids.length === 0) return out;
  const { data } = await supabase.rpc("host_recommend_stats", { p_hosts: ids });
  (data ?? []).forEach((r: { host_id: string; recommend_pct: number; review_count: number }) => {
    out[r.host_id] = { pct: r.recommend_pct, count: r.review_count };
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
