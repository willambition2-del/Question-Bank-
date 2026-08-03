import { Injectable } from '@nestjs/common';

export const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 900, 1500, 2500, 4000,
] as const;

@Injectable()
export class LevelService {
  levelFor(points: number) {
    let level = 1;
    for (let index = 0; index < LEVEL_THRESHOLDS.length; index += 1) {
      if (points >= LEVEL_THRESHOLDS[index]) level = index + 1;
    }
    return level;
  }

  progress(points: number) {
    const currentLevel = this.levelFor(points);
    const currentLevelMinimum = LEVEL_THRESHOLDS[currentLevel - 1] ?? 0;
    const nextLevelMinimum = LEVEL_THRESHOLDS[currentLevel] ?? null;
    const progressPercent =
      nextLevelMinimum === null
        ? 100
        : Number(
            (
              ((points - currentLevelMinimum) /
                (nextLevelMinimum - currentLevelMinimum)) *
              100
            ).toFixed(2),
          );
    return {
      currentLevel,
      currentPoints: points,
      currentLevelMinimum,
      nextLevelMinimum,
      progressPercent,
    };
  }
}
