import { redirect } from "next/navigation";
import { VibeQuiz } from "@/components/onboarding/VibeQuiz";
import {
  completeVibeCheck,
  getVibeProgress,
} from "@/lib/onboarding/vibe-actions";
import { safeRedirectPath, withReturnTo } from "@/lib/redirects";

export default async function VibeCheckPage({
  searchParams,
}: {
  searchParams: { returnTo?: string };
}) {
  const returnTo = safeRedirectPath(searchParams.returnTo, "");
  const progress = await getVibeProgress();

  if (progress.isComplete) {
    redirect(withReturnTo("/onboarding/vibe-check/reveal", returnTo));
  }
  if (progress.nextQuestionIndex === -1) {
    await completeVibeCheck();
    redirect(withReturnTo("/onboarding/vibe-check/reveal", returnTo));
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md overflow-hidden">
      <VibeQuiz
        initialAnswers={progress.answers}
        initialQuestionIndex={progress.nextQuestionIndex}
        returnTo={returnTo}
      />
    </main>
  );
}
