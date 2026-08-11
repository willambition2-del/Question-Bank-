import 'package:flutter_test/flutter_test.dart';
import 'package:app_app/core/repositories/analytics_api_repositories.dart';

void main() {
  group('Analytics and gamification API contracts', () {
    test(
      'statistics overview and chart points parse zero-safe values',
      () async {
        final remote = _FakeAnalytics();
        final repository = StatisticsApiRepository(remote);

        final overview = await repository.overview(range: 'month');
        final trend = await repository.accuracyTrend(range: 'month');
        final questions = await repository.questions(range: 'month');
        final distribution = await repository.timeDistribution(range: 'month');

        expect(
          remote.queries['/statistics/overview'],
          containsPair('range', 'month'),
        );
        expect(overview.totalAnswered, 0);
        expect(overview.accuracyPercent, 0);
        expect(overview.rank, isNull);
        expect(trend.single.accuracyPercent, 75.5);
        expect(questions.difficultyDistribution['MEDIUM'], 3);
        expect(questions.averageAnswerTimeMs, 4200);
        expect(distribution.single.key, 'FAST');
      },
    );

    test('custom statistics query sends validated UTC range', () {
      final query = statisticsQuery(
        range: 'all',
        from: DateTime.parse('2026-01-01T03:00:00+03:00'),
        to: DateTime.parse('2026-01-02T03:00:00+03:00'),
      );

      expect(query['from'], '2026-01-01T00:00:00.000Z');
      expect(query['to'], '2026-01-02T00:00:00.000Z');
    });

    test('recommendations remain server generated and typed', () async {
      final bundle = await RecommendationsApiRepository(
        _FakeAnalytics(),
      ).get(limit: 5);

      expect(bundle.weaknesses.single.score, 81.5);
      expect(bundle.weaknesses.single.reason, 'Repeated mistakes');
      expect(bundle.lessons.single.name, 'Motion');
      expect(bundle.lessons.single.availableQuestions, 8);
    });

    test(
      'points and daily tasks parse backend level policy and claim state',
      () async {
        final repository = GamificationApiRepository(_FakeAnalytics());
        final points = await repository.points();
        final tasks = await repository.dailyTasks();
        final history = await repository.pointsHistory();
        final claimed = await repository.claimDailyTask('task-1');

        expect(points.currentLevel, 3);
        expect(points.currentPoints, 300);
        expect(points.nextLevelMinimum, 500);
        expect(tasks.single.progress, 2);
        expect(tasks.single.pointsReward, 25);
        expect(claimed.rewardClaimed, isTrue);
        expect(history.items.single.amount, 25);
        expect(history.meta.totalItems, 1);
      },
    );

    test(
      'achievement key mapping uses backend icon key with safe fallback data',
      () async {
        final achievements = await AchievementsApiRepository(
          _FakeAnalytics(),
        ).getAchievements();

        expect(achievements.single.badgeIcon, 'streak');
        expect(achievements.single.isUnlocked, isTrue);
        expect(achievements.single.progress, 1);
      },
    );

    test(
      'leaderboard preserves pagination and appends current rank when off page',
      () async {
        final repository = LeaderboardsApiRepository(_FakeAnalytics());
        final page = await repository.page(period: 'weekly', scope: 'global');
        final legacy = await repository.getLeaderboard('week', 'general');

        expect(page.pagination.totalItems, 50);
        expect(page.topPlayers.single.rank, 1);
        expect(page.currentUser?.rank, 48);
        expect(legacy.map((item) => item.rank), containsAll([1, 48]));
      },
    );
  });
}

final class _FakeAnalytics implements AnalyticsDataSource {
  final Map<String, Map<String, dynamic>> queries = {};

  @override
  Future<Object?> get(String path, [Map<String, dynamic>? query]) async {
    queries[path] = Map<String, dynamic>.from(query ?? const {});
    return switch (path) {
      '/statistics/overview' => {
        'totalAnswered': 0,
        'totalQuestions': 0,
        'totalAvailableQuestions': 100,
        'totalCorrect': 0,
        'totalWrong': 0,
        'accuracyPercent': 0,
        'completedQuizzes': 0,
        'averageQuizScore': 0,
        'averageAnswerTimeMs': 0,
        'studyTimeSeconds': 0,
        'masteryPercent': 0,
        'currentStreakDays': 0,
        'bestStreakDays': 0,
        'totalPoints': 0,
        'level': 1,
        'rank': null,
      },
      '/statistics/accuracy-trend' => [
        {
          'date': '2026-01-01T00:00:00.000Z',
          'answeredCount': 4,
          'accuracyPercent': 75.5,
        },
      ],
      '/statistics/time-distribution' => [
        {'key': 'FAST', 'count': 2},
      ],
      '/statistics/questions' => {
        'difficultyDistribution': {'EASY': 1, 'MEDIUM': 3},
        'averageAnswerTimeMs': 4200,
        'mistakeFrequency': <dynamic>[],
      },
      '/recommendations' => {
        'generatedAt': '2026-01-01T00:00:00.000Z',
        'weaknesses': [
          {
            'score': 81.5,
            'reason': 'Repeated mistakes',
            'question': {
              'id': 'q1',
              'questionText': 'Question',
              'subjectName': 'Physics',
              'lessonId': 'lesson-1',
            },
            'masteryPercent': 20,
            'wrongCount': 4,
          },
        ],
        'lessons': [
          {
            'score': 70,
            'reason': 'Low mastery',
            'lesson': {
              'id': 'lesson-1',
              'name': 'Motion',
              'subjectId': 'subject-1',
              'subjectName': 'Physics',
              'unitId': 'unit-1',
              'availableQuestions': 8,
            },
            'masteryPercent': 30,
            'accuracyPercent': 40,
          },
        ],
      },
      '/gamification/points' => {
        'currentLevel': 3,
        'currentPoints': 300,
        'currentLevelMinimum': 250,
        'nextLevelMinimum': 500,
        'progressPercent': 20,
      },
      '/daily-tasks/today' => [_task(claimed: false)],
      '/achievements' => [
        {
          'id': 'achievement-1',
          'key': 'seven_day_streak',
          'name': 'Streak',
          'description': 'Seven days',
          'iconKey': 'streak',
          'category': 'STREAK',
          'conditionValue': 7,
          'pointsReward': 50,
          'unlocked': true,
          'unlockedAt': '2026-01-01T00:00:00.000Z',
          'isSeen': false,
        },
      ],
      '/leaderboards' => {
        'period': 'weekly',
        'scope': 'global',
        'metric': 'xp',
        'currentUser': _player(rank: 48, id: 'me'),
        'topPlayers': [_player(rank: 1, id: 'top')],
        'pagination': {
          'page': 1,
          'limit': 20,
          'totalItems': 50,
          'totalPages': 3,
          'hasNextPage': true,
          'hasPreviousPage': false,
        },
      },
      _ => <String, dynamic>{},
    };
  }

  @override
  Future<Map<String, dynamic>> getEnvelope(
    String path, [
    Map<String, dynamic>? query,
  ]) async {
    if (path == '/gamification/points/history') {
      return {
        'data': [
          {
            'id': 'transaction-1',
            'amount': 25,
            'type': 'DAILY_TASK',
            'description': 'Task reward',
            'createdAt': '2026-01-01T00:00:00.000Z',
          },
        ],
        'meta': {
          'page': 1,
          'limit': 20,
          'totalItems': 1,
          'totalPages': 1,
          'hasNextPage': false,
          'hasPreviousPage': false,
        },
      };
    }
    return {'data': await get(path, query)};
  }

  @override
  Future<Object?> post(String path, [Map<String, dynamic>? data]) async {
    if (path == '/daily-tasks/task-1/claim') return _task(claimed: true);
    return <String, dynamic>{};
  }
}

Map<String, dynamic> _task({required bool claimed}) => {
  'id': 'task-1',
  'progress': 2,
  'targetValue': 2,
  'isCompleted': true,
  'rewardClaimedAt': claimed ? '2026-01-01T00:00:00.000Z' : null,
  'taskDefinition': {
    'key': 'answer_questions',
    'title': 'Answer questions',
    'description': 'Answer two questions',
    'pointsReward': 25,
  },
};

Map<String, dynamic> _player({required int rank, required String id}) => {
  'rank': rank,
  'userId': id,
  'displayName': id == 'me' ? 'Current User' : 'Top User',
  'schoolName': 'School',
  'points': rank == 1 ? 1000 : 10,
  'level': rank == 1 ? 5 : 1,
  'companion': 'MALE',
  'accuracyPercent': 80,
};
