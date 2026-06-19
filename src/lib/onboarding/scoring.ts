import { VIBE_QUESTIONS, ScoreWeights } from "./questions";
import { Answer, VibeDimension, VibeScores } from "./types";

const DIMENSIONS: VibeDimension[] = [
  "culture",
  "social",
  "food",
  "night",
  "adventure",
  "wellness",
];

const EMPTY_SCORES: VibeScores = {
  culture: 0,
  social: 0,
  food: 0,
  night: 0,
  adventure: 0,
  wellness: 0,
};

// Max score each dimension could realistically earn across the quiz. Used to
// normalize raw totals so dimensions with fewer "paths to win" (e.g. food,
// night) aren't structurally disadvantaged and culture doesn't win by default.
function maxPossibleScores(): VibeScores {
  const max: VibeScores = { ...EMPTY_SCORES };
  for (const question of VIBE_QUESTIONS) {
    switch (question.type) {
      case "mood":
      case "tap":
        for (const d of DIMENSIONS) {
          max[d] += Math.max(0, ...question.options.map((o) => o.score[d] ?? 0));
        }
        break;
      case "multi":
        for (const d of DIMENSIONS) {
          const top = question.options
            .map((o) => o.score[d] ?? 0)
            .sort((a, b) => b - a)
            .slice(0, question.maxSelect);
          max[d] += top.reduce((sum, v) => sum + v, 0);
        }
        break;
      case "slider":
        max.adventure += 2;
        max.culture += 2;
        break;
      case "swipe":
        for (const d of DIMENSIONS) {
          max[d] += Math.max(question.left.score[d] ?? 0, question.right.score[d] ?? 0);
        }
        break;
    }
  }
  return max;
}

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
  const max = maxPossibleScores();
  let best: VibeDimension[] = [];
  let bestNorm = -1;
  for (const d of DIMENSIONS) {
    const norm = max[d] > 0 ? scores[d] / max[d] : 0;
    if (norm > bestNorm + 1e-9) {
      bestNorm = norm;
      best = [d];
    } else if (Math.abs(norm - bestNorm) <= 1e-9) {
      best.push(d);
    }
  }
  // Random tie-break so ties don't always resolve to the first dimension.
  return best[Math.floor(Math.random() * best.length)] ?? "culture";
}

export function pct(left: number, right: number): number {
  const total = left + right;
  if (total === 0) return 50;
  return Math.max(12, Math.min(88, Math.round((left / total) * 100)));
}
