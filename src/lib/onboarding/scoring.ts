import { VIBE_QUESTIONS, ScoreWeights } from "./questions";
import { Answer, VibeDimension, VibeScores } from "./types";

const EMPTY_SCORES: VibeScores = {
  culture: 0,
  social: 0,
  food: 0,
  night: 0,
  adventure: 0,
  wellness: 0,
};

function addWeights(scores: VibeScores, weights: ScoreWeights) {
  (Object.keys(weights) as VibeDimension[]).forEach((dimension) => {
    scores[dimension] += weights[dimension] ?? 0;
  });
}

export function computeScores(
  answers: Partial<Record<string, Answer>>
): VibeScores {
  const scores: VibeScores = { ...EMPTY_SCORES };

  for (const question of VIBE_QUESTIONS) {
    const answer = answers[question.id];
    if (!answer) continue;

    switch (question.type) {
      case "mood":
      case "tap": {
        if (answer.type !== question.type) break;
        const option = question.options[answer.index];
        if (option) addWeights(scores, option.score);
        break;
      }
      case "multi": {
        if (answer.type !== "multi") break;
        answer.indices.forEach((index) => {
          const option = question.options[index];
          if (option) addWeights(scores, option.score);
        });
        break;
      }
      case "slider": {
        if (answer.type !== "slider") break;
        const value = answer.value / 100;
        scores.adventure += value * 2;
        scores.culture += (1 - value) * 2;
        break;
      }
      case "swipe": {
        if (answer.type !== "swipe") break;
        const side = answer.side === "left" ? question.left : question.right;
        addWeights(scores, side.score);
        break;
      }
    }
  }

  return scores;
}

export function topArchetype(scores: VibeScores): VibeDimension {
  let top: VibeDimension = "culture";
  let max = -1;
  (Object.keys(scores) as VibeDimension[]).forEach((dimension) => {
    if (scores[dimension] > max) {
      max = scores[dimension];
      top = dimension;
    }
  });
  return top;
}

export function pct(left: number, right: number): number {
  const total = left + right;
  if (total === 0) return 50;
  return Math.max(12, Math.min(88, Math.round((left / total) * 100)));
}
