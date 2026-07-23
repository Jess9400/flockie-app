import { createClient } from "@/lib/supabase/server";

export type ProfileStoryReview = {
  id: string;
  body: string;
  createdAt: string;
  reviewerName: string;
  reviewerPhoto: string | null;
};

/**
 * Profile feedback is intentionally qualitative: the public profile never
 * shows a numeric average or star score. A row exists only after a verified
 * buddy match, and this display keeps only written, positive feedback.
 */
export async function getProfileStoryReviews(userId: string): Promise<ProfileStoryReview[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("reviews")
    .select("id, reviewer_id, comment, created_at")
    .eq("subject_id", userId)
    .gte("rating", 4)
    .not("comment", "is", null)
    .order("created_at", { ascending: false })
    .limit(12);

  const writtenRows = (rows ?? []).filter(
    (row): row is { id: string; reviewer_id: string; comment: string; created_at: string } =>
      typeof row.comment === "string" && row.comment.trim().length > 0
  );
  const reviewerIds = Array.from(new Set(writtenRows.map((row) => row.reviewer_id)));
  if (reviewerIds.length === 0) return [];

  const { data: reviewers } = await supabase
    .from("public_profiles")
    .select("id, display_name, photos")
    .in("id", reviewerIds);
  const reviewersById = new Map(
    (reviewers ?? []).map((reviewer) => [
      reviewer.id,
      {
        name: reviewer.display_name?.trim() || "A Flockie",
        photo: reviewer.photos?.[0] ?? null,
      },
    ])
  );

  return writtenRows.flatMap((row) => {
    const reviewer = reviewersById.get(row.reviewer_id);
    if (!reviewer) return [];
    return [{
      id: row.id,
      body: row.comment.trim(),
      createdAt: row.created_at,
      reviewerName: reviewer.name,
      reviewerPhoto: reviewer.photo,
    }];
  });
}
