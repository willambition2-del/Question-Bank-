import { Injectable } from '@nestjs/common';

export const MASTERY_THRESHOLDS = {
  score: 80,
  minimumAttempts: 3,
  minimumConsecutiveCorrect: 2,
} as const;

export type MasteryInput = {
  attemptsCount: number;
  correctCount: number;
  consecutiveCorrect: number;
  averageTimeMs: number;
  lastAnsweredAt: Date;
};

@Injectable()
export class MasteryService {
  calculate(input: MasteryInput) {
    const accuracy =
      input.attemptsCount === 0 ? 0 : input.correctCount / input.attemptsCount;
    const accuracyPoints = accuracy * 50;
    const repetitionPoints = Math.min(input.attemptsCount / 5, 1) * 15;
    const streakPoints = Math.min(input.consecutiveCorrect / 3, 1) * 15;
    const ageDays = Math.max(
      0,
      (Date.now() - input.lastAnsweredAt.getTime()) / 86_400_000,
    );
    const recencyPoints = Math.max(0, 1 - ageDays / 30) * 10;
    const speedPoints =
      input.averageTimeMs <= 0
        ? 0
        : Math.max(0, Math.min(1, (60_000 - input.averageTimeMs) / 45_000)) *
          10;
    const masteryScore = Number(
      Math.min(
        100,
        accuracyPoints +
          repetitionPoints +
          streakPoints +
          recencyPoints +
          speedPoints,
      ).toFixed(2),
    );
    return {
      masteryScore,
      isMastered:
        masteryScore >= MASTERY_THRESHOLDS.score &&
        input.attemptsCount >= MASTERY_THRESHOLDS.minimumAttempts &&
        input.consecutiveCorrect >=
          MASTERY_THRESHOLDS.minimumConsecutiveCorrect,
    };
  }
}
