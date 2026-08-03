import { Injectable } from '@nestjs/common';

export const CHALLENGE_SCORING = {
  correct: 100,
  maxSpeedBonus: 50,
  maxComboBonus: 50,
} as const;

@Injectable()
export class ChallengeScoringService {
  score(
    isCorrect: boolean,
    responseTimeMs: number,
    limitSeconds: number,
    combo: number,
  ) {
    if (!isCorrect) return 0;
    const limitMs = Math.max(1, limitSeconds * 1000);
    const speedRatio = Math.max(0, Math.min(1, 1 - responseTimeMs / limitMs));
    const speedBonus = Math.round(speedRatio * CHALLENGE_SCORING.maxSpeedBonus);
    const comboBonus = Math.min(
      Math.max(0, combo) * 10,
      CHALLENGE_SCORING.maxComboBonus,
    );
    return CHALLENGE_SCORING.correct + speedBonus + comboBonus;
  }
}
