import 'package:dio/dio.dart';

import '../models/achievement_model.dart';
import '../models/daily_task_model.dart';
import '../models/leaderboard_entry.dart';
import '../network/analytics_api_models.dart';
import '../network/api_call.dart';
import '../network/api_response.dart';
import '../network/quiz_api_models.dart';
import 'interfaces.dart';
import 'quiz_api_repository.dart';

abstract interface class AnalyticsDataSource {
  Future<Object?> get(String path, [Map<String, dynamic>? query]);
  Future<Object?> post(String path, [Map<String, dynamic>? data]);
  Future<Map<String, dynamic>> getEnvelope(
    String path, [
    Map<String, dynamic>? query,
  ]);
}

final class AnalyticsRemoteDataSource implements AnalyticsDataSource {
  final Dio _dio;
  AnalyticsRemoteDataSource(this._dio);

  @override
  Future<Object?> get(String path, [Map<String, dynamic>? query]) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        path,
        queryParameters: query,
      );
      return requireObject(response.data)['data'];
    } on DioException catch (error) {
      throwApiError(error);
    }
  }

  @override
  Future<Map<String, dynamic>> getEnvelope(
    String path, [
    Map<String, dynamic>? query,
  ]) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        path,
        queryParameters: query,
      );
      return requireObject(response.data);
    } on DioException catch (error) {
      throwApiError(error);
    }
  }

  @override
  Future<Object?> post(String path, [Map<String, dynamic>? data]) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(path, data: data);
      return requireObject(response.data)['data'];
    } on DioException catch (error) {
      throwApiError(error);
    }
  }
}

Map<String, dynamic> statisticsQuery({
  String range = 'week',
  DateTime? from,
  DateTime? to,
}) => {
  'range': range,
  if (from != null) 'from': from.toUtc().toIso8601String(),
  if (to != null) 'to': to.toUtc().toIso8601String(),
};

final class StatisticsApiRepository {
  final AnalyticsDataSource _remote;
  StatisticsApiRepository(this._remote);

  Future<StatisticsOverview> overview({
    String range = 'week',
    DateTime? from,
    DateTime? to,
  }) async => StatisticsOverview.fromJson(
    requireObject(
      await _remote.get(
        '/statistics/overview',
        statisticsQuery(range: range, from: from, to: to),
      ),
    ),
  );

  Future<List<ActivityPoint>> activity({
    String range = 'week',
    DateTime? from,
    DateTime? to,
  }) async => _list(
    await _remote.get(
      '/statistics/activity',
      statisticsQuery(range: range, from: from, to: to),
    ),
    ActivityPoint.fromJson,
  );

  Future<List<ProgressMetric>> subjects() async =>
      _list(await _remote.get('/statistics/subjects'), ProgressMetric.fromJson);

  Future<ProgressMetric> subject(String id) async => ProgressMetric.fromJson(
    requireObject(await _remote.get('/statistics/subjects/$id')),
  );
  Future<ProgressMetric> unit(String id) async => ProgressMetric.fromJson(
    requireObject(await _remote.get('/statistics/units/$id')),
  );
  Future<ProgressMetric> lesson(String id) async => ProgressMetric.fromJson(
    requireObject(await _remote.get('/statistics/lessons/$id')),
  );

  Future<List<AccuracyTrendPoint>> accuracyTrend({
    String range = 'week',
    DateTime? from,
    DateTime? to,
  }) async => _list(
    await _remote.get(
      '/statistics/accuracy-trend',
      statisticsQuery(range: range, from: from, to: to),
    ),
    AccuracyTrendPoint.fromJson,
  );

  Future<List<HeatmapPoint>> heatmap({
    String range = 'week',
    DateTime? from,
    DateTime? to,
  }) async => _list(
    await _remote.get(
      '/statistics/heatmap',
      statisticsQuery(range: range, from: from, to: to),
    ),
    HeatmapPoint.fromJson,
  );

  Future<List<TimeDistributionBucket>> timeDistribution({
    String range = 'week',
    DateTime? from,
    DateTime? to,
  }) async => _list(
    await _remote.get(
      '/statistics/time-distribution',
      statisticsQuery(range: range, from: from, to: to),
    ),
    TimeDistributionBucket.fromJson,
  );
  Future<QuestionAnalytics> questions({
    String range = 'week',
    DateTime? from,
    DateTime? to,
  }) async => QuestionAnalytics.fromJson(
    requireObject(
      await _remote.get(
        '/statistics/questions',
        statisticsQuery(range: range, from: from, to: to),
      ),
    ),
  );
}

final class RecommendationsApiRepository {
  final AnalyticsDataSource _remote;
  RecommendationsApiRepository(this._remote);

  Map<String, dynamic> _query(String? subjectId, int limit) => {
    'subjectId': ?subjectId,
    'limit': limit,
  };

  Future<RecommendationBundle> get({String? subjectId, int limit = 10}) async =>
      RecommendationBundle.fromJson(
        requireObject(
          await _remote.get('/recommendations', _query(subjectId, limit)),
        ),
      );

  Future<List<RecommendationWeakness>> weaknesses({
    String? subjectId,
    int limit = 10,
  }) async => _list(
    await _remote.get('/recommendations/weaknesses', _query(subjectId, limit)),
    RecommendationWeakness.fromJson,
  );

  Future<List<RecommendationLesson>> lessons({
    String? subjectId,
    int limit = 10,
  }) async => _list(
    await _remote.get('/recommendations/lessons', _query(subjectId, limit)),
    RecommendationLesson.fromJson,
  );

  Future<QuizStartResponse> createWeaknessQuiz(
    QuizCreateRequest request,
  ) async => QuizStartResponse.fromJson(
    requireObject(
      await _remote.post(
        '/recommendations/weakness-quiz',
        request.toCollectionJson(),
      ),
    ),
  );
}

final class GamificationApiRepository {
  final AnalyticsDataSource _remote;
  GamificationApiRepository(this._remote);

  Future<PointsProfile> points() async => PointsProfile.fromJson(
    requireObject(await _remote.get('/gamification/points')),
  );

  Future<PointHistoryPage> pointsHistory({int page = 1, int limit = 20}) async {
    final root = await _remote.getEnvelope('/gamification/points/history', {
      'page': page,
      'limit': limit,
    });
    return PointHistoryPage(
      _list(root['data'], PointTransaction.fromJson),
      PageMeta.fromJson(requireObject(root['meta'], 'meta')),
    );
  }

  Future<List<DailyTask>> dailyTasks() async =>
      _list(await _remote.get('/daily-tasks/today'), DailyTask.fromJson);

  Future<DailyTask> claimDailyTask(String id) async => DailyTask.fromJson(
    requireObject(await _remote.post('/daily-tasks/$id/claim')),
  );
}

final class AchievementsApiRepository implements AchievementsRepository {
  final AnalyticsDataSource _remote;
  AchievementsApiRepository(this._remote);

  Future<List<AchievementApiModel>> list() async =>
      _list(await _remote.get('/achievements'), AchievementApiModel.fromJson);

  Future<AchievementApiModel> markSeen(String id) async =>
      AchievementApiModel.fromJson(
        requireObject(await _remote.post('/achievements/$id/mark-seen')),
      );

  @override
  Future<List<AchievementModel>> getAchievements() async =>
      (await list()).map((item) => item.toLegacy()).toList(growable: false);

  @override
  Future<void> unlockAchievement(String id) =>
      throw UnsupportedError('Achievements are unlocked only by the backend.');
}

final class DailyTasksApiRepository implements DailyTasksRepository {
  final GamificationApiRepository _api;
  DailyTasksApiRepository(this._api);

  @override
  Future<List<DailyTaskModel>> getDailyTasks() async =>
      (await _api.dailyTasks())
          .map((item) => item.toLegacy())
          .toList(growable: false);

  @override
  Future<void> updateDailyTaskProgress(String id, int progress) =>
      throw UnsupportedError('Daily task progress is owned by the backend.');
}

final class LeaderboardsApiRepository implements LeaderboardRepository {
  final AnalyticsDataSource _remote;
  LeaderboardsApiRepository(this._remote);

  Future<LeaderboardPage> page({
    int page = 1,
    int limit = 20,
    String period = 'weekly',
    String scope = 'global',
    String metric = 'xp',
    String? subjectId,
  }) async => LeaderboardPage.fromJson(
    requireObject(
      await _remote.get('/leaderboards', {
        'page': page,
        'limit': limit,
        'period': period,
        'scope': scope,
        'metric': metric,
        'subjectId': ?subjectId,
      }),
    ),
  );

  Future<LeaderboardPlayer?> currentUser({
    String period = 'weekly',
    String scope = 'global',
    String metric = 'xp',
    String? subjectId,
  }) async {
    final root = requireObject(
      await _remote.get('/leaderboards/me', {
        'period': period,
        'scope': scope,
        'metric': metric,
        'subjectId': ?subjectId,
      }),
    );
    return root['currentUser'] is Map
        ? LeaderboardPlayer.fromJson(requireObject(root['currentUser']))
        : null;
  }

  @override
  Future<List<LeaderboardEntry>> getLeaderboard(
    String timeFilter,
    String typeFilter,
  ) async {
    final period = switch (timeFilter) {
      'day' => 'daily',
      'month' => 'monthly',
      'all' => 'all',
      _ => 'weekly',
    };
    final scope = typeFilter == 'school' ? 'school' : 'global';
    final result = await page(period: period, scope: scope);
    final players = [...result.topPlayers];
    final current = result.currentUser;
    if (current != null &&
        !players.any((item) => item.userId == current.userId)) {
      players.add(current);
    }
    return players.map((item) => item.toLegacy()).toList(growable: false);
  }
}

List<T> _list<T>(Object? value, T Function(Map<String, dynamic>) parser) =>
    requireList(
      value,
    ).map((item) => parser(requireObject(item))).toList(growable: false);
