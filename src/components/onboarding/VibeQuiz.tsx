"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionControls } from "./QuestionControls";
import { VIBE_QUESTIONS, TOTAL_QUESTIONS } from "@/lib/onboarding/questions";
import { Answer } from "@/lib/onboarding/types";
import { completeVibeCheck, saveVibeAnswer } from "@/lib/onboarding/vibe-actions";

export function VibeQuiz({ initialAnswers, initialQuestionIndex }: { initialAnswers: Partial<Record<string, Answer>>; initialQuestionIndex: number }) {
  const router = useRouter();
  const [answers, setAnswers] = useState(initialAnswers);
  const [questionIndex, setQuestionIndex] = useState(Math.max(0, Math.min(initialQuestionIndex, TOTAL_QUESTIONS - 1)));
  const [showExitSheet, setShowExitSheet] = useState(false);
  const [paused, setPaused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const question = VIBE_QUESTIONS[questionIndex];

  async function handleAnswer(answer: Answer) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveVibeAnswer(question.id, answer);
      setAnswers((previous) => ({ ...previous, [question.id]: answer }));
      if (questionIndex < TOTAL_QUESTIONS - 1) {
        setQuestionIndex((index) => index + 1);
        setSaving(false);
      } else {
        await completeVibeCheck();
        router.push("/onboarding/vibe-check/reveal");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your answer. Try again.");
      setSaving(false);
    }
  }

  if (paused) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-cream px-7 text-center font-nunito">
        <div className="mb-4 flex h-[62px] w-[62px] items-center justify-center rounded-full bg-onboarding-green text-2xl text-white">✓</div>
        <h2 className="mb-2 text-[23px] font-black">Paused, not skipped</h2>
        <p className="mb-6 max-w-[260px] text-[13.5px] font-semibold leading-relaxed text-muted">Your answers are saved. We&apos;ll bring you back to question {questionIndex + 1}.</p>
        <button type="button" onClick={() => setPaused(false)} className="rounded-2xl border-2 border-ink border-b-[5px] bg-flockie-coral px-8 py-3.5 text-[14.5px] font-extrabold text-white">Continue now →</button>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-cream font-nunito">
      <div className="flex items-center gap-2.5 border-b border-ink/10 bg-white px-4 py-3">
        <button type="button" onClick={() => setQuestionIndex((index) => Math.max(0, index - 1))} className={questionIndex === 0 ? "invisible" : ""} aria-label="Back"><span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-cream">‹</span></button>
        <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-flockie-coral transition-all" style={{ width: `${((questionIndex + 1) / TOTAL_QUESTIONS) * 100}%` }} /></div>
        <button type="button" onClick={() => setShowExitSheet(true)} aria-label="Pause"><span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-cream">✕</span></button>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-4 pt-5">
        <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-flockie-coral">Question {questionIndex + 1} of {TOTAL_QUESTIONS}</p>
        <p className="mb-3 text-[10px] font-bold text-muted">{question.mechanicLabel}</p>
        <h1 className="mb-4 text-[21px] font-black leading-tight">{question.text}</h1>
        <QuestionControls question={question} currentAnswer={answers[question.id]} disabled={saving} onAnswer={handleAnswer} />
        {saving && <p className="mt-3 text-center text-xs font-semibold text-muted">Saving…</p>}
        {error && <p className="mt-3 text-center text-xs font-semibold text-red-700">{error}</p>}
      </div>

      {showExitSheet && (
        <div className="absolute inset-0 z-50 flex items-end bg-ink/45">
          <div className="w-full rounded-t-3xl bg-white p-6 text-center">
            <div className="mb-2.5 text-4xl">⏸️</div>
            <h2 className="mb-1.5 text-[19px] font-black">Pause here?</h2>
            <p className="mb-5 text-[13px] font-semibold leading-relaxed text-muted">Your completed answers are already saved. Jump back in whenever.</p>
            <button type="button" onClick={() => setShowExitSheet(false)} className="mb-2.5 w-full rounded-2xl border-2 border-ink border-b-[5px] bg-flockie-coral py-3.5 text-[14.5px] font-extrabold text-white">Keep going</button>
            <button type="button" onClick={() => { setShowExitSheet(false); setPaused(true); }} className="w-full rounded-2xl border-2 border-ink/15 bg-cream py-3.5 text-[14.5px] font-extrabold">Pause for now</button>
          </div>
        </div>
      )}
    </div>
  );
}
