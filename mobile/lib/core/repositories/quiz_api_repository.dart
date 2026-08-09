import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../network/api_call.dart';
import '../network/api_response.dart';
import '../network/quiz_api_models.dart';

abstract interface class QuizRemoteDataSource {
  Future<Map<String, dynamic>> create(Map<String, dynamic> request);
  Future<Map<String, dynamic>> getAttempt(String id);
  Future<Map<String, dynamic>> submitAnswer(
    String id,
    Map<String, dynamic> request,
  );
  Future<Map<String, dynamic>> complete(String id);
  Future<Map<String, dynamic>> abandon(String id);
  Future<Map<String, dynamic>> result(String id);
  Future<Map<String, dynamic>> history(Map<String, dynamic> query);
}

final class DioQuizRemoteDataSource implements QuizRemoteDataSource {
  final Dio _dio;
  DioQuizRemoteDataSource(this._dio);

  Future<Map<String, dynamic>> _data(
    Future<Response<Map<String, dynamic>>> call,
  ) async {
    try {
      final response = await call;
      return requireObject(requireObject(response.data)['data'], 'data');
    } on DioException catch (error) {
      throwApiError(error);
    }
  }

  @override
  Future<Map<String, dynamic>> create(Map<String, dynamic> request) =>
      _data(_dio.post('/quiz-attempts', data: request));
  @override
  Future<Map<String, dynamic>> getAttempt(String id) =>
      _data(_dio.get('/quiz-attempts/$id'));
  @override
  Future<Map<String, dynamic>> submitAnswer(
    String id,
    Map<String, dynamic> request,
  ) => _data(_dio.post('/quiz-attempts/$id/answers', data: request));
  @override
  Future<Map<String, dynamic>> complete(String id) =>
      _data(_dio.post('/quiz-attempts/$id/complete'));
  @override
  Future<Map<String, dynamic>> abandon(String id) =>
      _data(_dio.post('/quiz-attempts/$id/abandon'));
  @override
  Future<Map<String, dynamic>> result(String id) =>
      _data(_dio.get('/quiz-attempts/$id/result'));

  @override
  Future<Map<String, dynamic>> history(Map<String, dynamic> query) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/quiz-attempts',
        queryParameters: query,
      );
      return requireObject(response.data);
    } on DioException catch (error) {
      throwApiError(error);
    }
  }
}

final class QuizCreateRequest {
  final String scope;
  final String? subjectId;
  final String? unitId;
  final String? lessonId;
  final String? examModelId;
  final int questionCount;
  final List<String>? questionTypes;
  final String difficulty;
  final String timingMode;
  final int? durationSeconds;
  final int? timePerQuestionSeconds;
  final bool heartsEnabled;
  final int initialHearts;
  final bool hintsEnabled;
  final bool eliminationEnabled;
  final String explanationMode;
  final bool excludeMastered;
  final bool unansweredOnly;

  const QuizCreateRequest({
    required this.scope,
    this.subjectId,
    this.unitId,
    this.lessonId,
    this.examModelId,
    required this.questionCount,
    this.questionTypes,
    required this.difficulty,
    required this.timingMode,
    this.durationSeconds,
    this.timePerQuestionSeconds,
    required this.heartsEnabled,
    required this.initialHearts,
    required this.hintsEnabled,
    required this.eliminationEnabled,
    required this.explanationMode,
    required this.excludeMastered,
    required this.unansweredOnly,
  });

  Map<String, dynamic> toJson() => {
    'scope': scope,
    if ((scope == 'SUBJECT' ||
            scope == 'MISTAKES' ||
            scope == 'WEAKNESS' ||
            scope == 'SAVED' ||
            scope == 'RANDOM') &&
        subjectId != null)
      'subjectId': subjectId,
    if ((scope == 'UNIT' ||
            scope == 'MISTAKES' ||
            scope == 'WEAKNESS' ||
            scope == 'SAVED') &&
        unitId != null)
      'unitId': unitId,
    if ((scope == 'LESSON' ||
            scope == 'MISTAKES' ||
            scope == 'WEAKNESS' ||
            scope == 'SAVED') &&
        lessonId != null)
      'lessonId': lessonId,
    if (scope == 'EXAM_MODEL' && examModelId != null)
      'examModelId': examModelId,
    'questionCount': questionCount,
    if (questionTypes != null && questionTypes!.isNotEmpty)
      'questionTypes': questionTypes,
    'difficulty': difficulty,
    'timingMode': timingMode,
    if (timingMode == 'TOTAL_TIME' && durationSeconds != null)
      'durationSeconds': durationSeconds,
    if (timingMode == 'PER_QUESTION' && timePerQuestionSeconds != null)
      'timePerQuestionSeconds': timePerQuestionSeconds,
    'heartsEnabled': heartsEnabled,
    if (heartsEnabled) 'initialHearts': initialHearts,
    'hintsEnabled': hintsEnabled,
    'eliminationEnabled': eliminationEnabled,
    'explanationMode': explanationMode,
    'excludeMastered': excludeMastered,
    'unansweredOnly': unansweredOnly,
  };

  Map<String, dynamic> toCollectionJson() => Map<String, dynamic>.from(toJson())
    ..remove('scope')
    ..remove('examModelId');
}

abstract interface class QuizLifecycleRepository {
  Future<QuizStartResponse> create(QuizCreateRequest request);
  Future<QuizStartResponse> getAttempt(String id);
  Future<QuizAnswerResponse> answer(
    String id, {
    required QuizQuestion question,
    required String selection,
    required int timeSpentMs,
    required bool hintUsed,
    required bool eliminatedOptionUsed,
  });
  Future<QuizAttemptSummary> complete(String id);
  Future<QuizAttemptSummary> abandon(String id);
  Future<QuizResult> getResult(String id);
  Future<QuizHistoryPage> getHistory({
    int page = 1,
    int limit = 20,
    String? status,
    String? scope,
    String? subjectId,
    DateTime? from,
    DateTime? to,
    String? sort,
  });
}

final class QuizApiRepository implements QuizLifecycleRepository {
  final QuizRemoteDataSource _remote;
  QuizApiRepository(this._remote);

  @override
  Future<QuizStartResponse> create(QuizCreateRequest request) async =>
      QuizStartResponse.fromJson(await _remote.create(request.toJson()));
  @override
  Future<QuizStartResponse> getAttempt(String id) async =>
      QuizStartResponse.fromJson(await _remote.getAttempt(id));
  @override
  Future<QuizAnswerResponse> answer(
    String id, {
    required QuizQuestion question,
    required String selection,
    required int timeSpentMs,
    required bool hintUsed,
    required bool eliminatedOptionUsed,
  }) async {
    final request = <String, dynamic>{
      'questionId': question.id,
      if (question.isTrueFalse)
        'selectedBoolean': selection == 'true'
      else
        'selectedOptionId': selection,
      'timeSpentMs': timeSpentMs.clamp(0, 3600000),
      'hintUsed': hintUsed,
      'eliminatedOptionUsed': eliminatedOptionUsed,
    };
    return QuizAnswerResponse.fromJson(await _remote.submitAnswer(id, request));
  }

  @override
  Future<QuizAttemptSummary> complete(String id) async =>
      QuizAttemptSummary.fromJson(await _remote.complete(id));
  @override
  Future<QuizAttemptSummary> abandon(String id) async =>
      QuizAttemptSummary.fromJson(await _remote.abandon(id));
  @override
  Future<QuizResult> getResult(String id) async =>
      QuizResult.fromJson(await _remote.result(id));
  @override
  Future<QuizHistoryPage> getHistory({
    int page = 1,
    int limit = 20,
    String? status,
    String? scope,
    String? subjectId,
    DateTime? from,
    DateTime? to,
    String? sort,
  }) async {
    final root = await _remote.history({
      'page': page,
      'limit': limit,
      'status': ?status,
      'scope': ?scope,
      'subjectId': ?subjectId,
      if (from != null) 'from': from.toUtc().toIso8601String(),
      if (to != null) 'to': to.toUtc().toIso8601String(),
      'sort': ?sort,
    });
    return QuizHistoryPage(
      requireList(root['data'])
          .map((item) => QuizAttemptSummary.fromJson(requireObject(item)))
          .toList(growable: false),
      PageMeta.fromJson(requireObject(root['meta'], 'meta')),
    );
  }
}

final class ActiveAttemptStorage {
  static const _key = 'quiz.active_attempt_id';
  Future<void> save(String id) async =>
      (await SharedPreferences.getInstance()).setString(_key, id);
  Future<String?> read() async =>
      (await SharedPreferences.getInstance()).getString(_key);
  Future<void> clear() async =>
      (await SharedPreferences.getInstance()).remove(_key);
}
