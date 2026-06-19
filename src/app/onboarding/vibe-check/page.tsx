import { redirect } from "next/navigation";
import { VibeQuiz } from "@/components/onboarding/VibeQuiz";
import {
  completeVibeCheck,
  getVibeProgress,
} from "@/lib/onboarding/vibe-actions";

export default async function VibeCheckPage() {
  const progress = await getVibeProgress();

  if (progress.isComplete) redirect("/onboarding/vibe-check/reveal");
  if (progress.nextQuestionIndex === -1) {
    await completeVibeCheck();
    redirect("/onboarding/vibe-check/reveal");
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md overflow-hidden">
      <VibeQuiz
        initialAnswers={progress.answers}
        initialQuestionIndex={progress.nextQuestionIndex}
      />
    </main>
  );
}
