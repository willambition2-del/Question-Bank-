import { Injectable } from '@nestjs/common';
import { QuestionDifficulty } from '../generated/prisma/enums';

export const QUIZ_COMPLETION_POINTS = 20;
const BASE_POINTS = 10;
const SPEED_BONUS = 5;
const HINT_PENALTY = 3;
const ELIMINATION_PENALTY = 2;
const FAST_THRESHOLD_MS = 15_000;
const MAX_ANSWER_POINTS = 20;

export type QuizScore = {
  points: number;
  correctPoints: number;
  speedBonus: number;
};

@Injectable()
export class QuizScoringService {
  score(input: {
    isCorrect: boolean;
    difficulty: QuestionDifficulty;
    serverElapsedMs: number;
    hintUsed: boolean;
    eliminatedOptionUsed: boolean;
  }): QuizScore {
    if (!input.isCorrect) return { points: 0, correctPoints: 0, speedBonus: 0 };
    const multiplier =
      input.difficulty === QuestionDifficulty.HARD
        ? 1.5
        : input.difficulty === QuestionDifficulty.MEDIUM
          ? 1.2
          : 1;
    const base = Math.round(BASE_POINTS * multiplier);
    const speedBonus =
      input.serverElapsedMs <= FAST_THRESHOLD_MS ? SPEED_BONUS : 0;
    const penalties =
      (input.hintUsed ? HINT_PENALTY : 0) +
      (input.eliminatedOptionUsed ? ELIMINATION_PENALTY : 0);
    const points = Math.max(
      0,
      Math.min(MAX_ANSWER_POINTS, base + speedBonus - penalties),
    );
    return {
      points,
      speedBonus: Math.min(speedBonus, points),
      correctPoints: Math.max(0, points - Math.min(speedBonus, points)),
    };
  }
}
