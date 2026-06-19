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
}> {
  const { supabase, user } = await authenticatedClient();
  const [{ data: profile }, { data: rows, error }] = await Promise.all([
    supabase
      .from("profiles")
      .select("vibe_completed_at")
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

export async function getNearbyVibes(city: string, limit = 3) {
  const { supabase, user } = await authenticatedClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, photos, home_city, archetype")
    .eq("home_city", city)
    .not("vibe_completed_at", "is", null)
    .neq("id", user.id)
    .limit(limit);

  if (error) throw error;
  return data;
}
