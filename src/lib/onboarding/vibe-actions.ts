"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Answer, VibeResponseRow } from "./types";
import { computeScores, topArchetype } from "./scoring";
import { TOTAL_QUESTIONS, VIBE_QUESTIONS } from "./questions";

async function authenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function saveVibeAnswer(questionId: string, answer: Answer) {
  if (!VIBE_QUESTIONS.some((question) => question.id === questionId)) {
    throw new Error("Unknown vibe question");
  }

  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase.from("vibe_responses").upsert(
    {
      profile_id: user.id,
      question_id: questionId,
      answer,
      answered_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,question_id" }
  );

  if (error) throw error;
}

export async function getVibeProgress(): Promise<{
  answers: Partial<Record<string, Answer>>;
  nextQuestionIndex: number;
  isComplete: boolean;
  isRetake: boolean;
}> {
  const { supabase, user } = await authenticatedClient();
  const [{ data: profile }, { data: rows, error }] = await Promise.all([
    supabase
      .from("profiles")
      .select("vibe_completed_at, archetype")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("vibe_responses")
      .select("question_id, answer")
      .eq("profile_id", user.id),
  ]);

  if (error) throw error;

  const answers: Partial<Record<string, Answer>> = {};
  (rows as VibeResponseRow[] | null)?.forEach((row) => {
    answers[row.question_id] = row.answer;
  });

  return {
    answers,
    nextQuestionIndex: VIBE_QUESTIONS.findIndex(
      (question) => !answers[question.id]
    ),
    isComplete: Boolean(profile?.vibe_completed_at),
    // An old result with no completed flag means a retake in progress —
    // the quiz UI locks its exit until the run is finished.
    isRetake: Boolean(profile?.archetype) && !profile?.vibe_completed_at,
  };
}

export async function completeVibeCheck() {
  const { supabase, user } = await authenticatedClient();
  const { data: rows, error: fetchError } = await supabase
    .from("vibe_responses")
    .select("question_id, answer")
    .eq("profile_id", user.id);

  if (fetchError) throw fetchError;

  const answers: Partial<Record<string, Answer>> = {};
  (rows as VibeResponseRow[] | null)?.forEach((row) => {
    answers[row.question_id] = row.answer;
  });

  const answeredQuestions = VIBE_QUESTIONS.filter(
    (question) => answers[question.id]
  ).length;
  if (answeredQuestions < TOTAL_QUESTIONS) {
    throw new Error(
      `Cannot complete: only ${answeredQuestions}/${TOTAL_QUESTIONS} questions answered`
    );
  }

  const scores = computeScores(answers);
  const archetype = topArchetype(scores);
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      vibe_scores: scores,
      archetype,
      vibe_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateError) throw updateError;
  return { scores, archetype };
}

// Clears the saved quiz answers so the user retakes it from question 1.
// Deliberately keeps archetype/vibe_scores: matching runs on the old result
// until completeVibeCheck overwrites it, so an unfinished retake never leaves
// the user without a signal.
export async function restartVibeCheck() {
  const { supabase, user } = await authenticatedClient();
  // .select() so a silent RLS deny (0 rows, no error) is detectable: the
  // retake flow requires the old answers to actually be gone, otherwise the
  // quiz page instantly re-completes from them.
  const { data: deleted, error: deleteError } = await supabase
    .from("vibe_responses")
    .delete()
    .eq("profile_id", user.id)
    .select("question_id");
  if (deleteError) throw deleteError;
  if (!deleted?.length) {
    const { count } = await supabase
      .from("vibe_responses")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id);
    if (count) throw new Error("Could not clear saved quiz answers");
  }
  const { error } = await supabase
    .from("profiles")
    .update({ vibe_completed_at: null })
    .eq("id", user.id);
  if (error) throw error;
}

export async function getNearbyVibes(city: string, limit = 3) {
  const { supabase, user } = await authenticatedClient();
  const { data, error } = await supabase
    .from("public_profiles")
    .select("id, display_name, photos, home_city, archetype")
    .eq("home_city", city)
    .not("archetype", "is", null)
    .neq("id", user.id)
    .limit(limit);

  if (error) throw error;
  return data;
}
