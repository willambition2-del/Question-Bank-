import { PrismaService } from '../prisma/prisma.service';
import { RecommendationService } from './recommendation.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('RecommendationService', () => {
  it('ranks weak published questions without exposing answer fields', async () => {
    const prisma = {
      studentQuestionProgress: {
        findMany: jest.fn().mockResolvedValue([
          {
            attemptsCount: 4,
            wrongCount: 3,
            masteryScore: 35,
            averageTimeMs: 40000,
            lastAnsweredAt: new Date('2026-07-01T00:00:00.000Z'),
            question: {
              id: 'question-1',
              questionText: 'Safe public stem',
              difficulty: 'HARD',
              subjectId: 'subject-1',
              unitId: 'unit-1',
              lessonId: 'lesson-1',
              subject: { name: 'Physics', sortOrder: 1 },
            },
          },
        ]),
      },
    };
    const service = new RecommendationService(
      prisma as unknown as PrismaService,
      {
        getJson: jest.fn().mockResolvedValue(null),
        setJson: jest.fn().mockResolvedValue(undefined),
      } as never,
    );
    const result = await service.weaknesses('user-1', { limit: 10 });
    expect(result[0]?.type).toBe('QUESTION_WEAKNESS');
    expect(result[0]?.wrongCount).toBe(3);
    expect(result[0]?.question.questionText).toBe('Safe public stem');
    expect(JSON.stringify(result)).not.toContain('isCorrect');
    expect(JSON.stringify(result)).not.toContain('correctOption');
    expect(prisma.studentQuestionProgress.findMany).toHaveBeenCalledTimes(1);
  });
});
