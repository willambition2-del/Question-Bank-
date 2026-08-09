import 'package:dio/dio.dart';

import '../network/api_call.dart';
import '../network/api_response.dart';
import '../network/progress_api_models.dart';
import '../network/quiz_api_models.dart';
import 'quiz_api_repository.dart';

abstract interface class ProgressRemoteDataSource {
  Future<Map<String, dynamic>> listMistakes(Map<String, dynamic> query);
  Future<Map<String, dynamic>> getMistake(String questionId);
  Future<Map<String, dynamic>> markMistakeReviewed(String questionId);
  Future<Map<String, dynamic>> createMistakesQuiz(Map<String, dynamic> request);
  Future<Map<String, dynamic>> listSaved(Map<String, dynamic> query);
  Future<Map<String, dynamic>> save(
    String questionId,
    Map<String, dynamic> request,
  );
  Future<Map<String, dynamic>> updateNote(
    String questionId,
    Map<String, dynamic> request,
  );
  Future<Map<String, dynamic>> remove(String questionId);
  Future<Map<String, dynamic>> createSavedQuiz(Map<String, dynamic> request);
}

final class DioProgressRemoteDataSource implements ProgressRemoteDataSource {
  final Dio _dio;
  DioProgressRemoteDataSource(this._dio);

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

  Future<Map<String, dynamic>> _page(
    String path,
    Map<String, dynamic> query,
  ) async {
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
  Future<Map<String, dynamic>> listMistakes(Map<String, dynamic> query) =>
      _page('/mistakes', query);
  @override
  Future<Map<String, dynamic>> getMistake(String questionId) =>
      _data(_dio.get('/mistakes/$questionId'));
  @override
  Future<Map<String, dynamic>> markMistakeReviewed(String questionId) =>
      _data(_dio.post('/mistakes/$questionId/mark-mastered'));
  @override
  Future<Map<String, dynamic>> createMistakesQuiz(
    Map<String, dynamic> request,
  ) => _data(_dio.post('/mistakes/quiz', data: request));
  @override
  Future<Map<String, dynamic>> listSaved(Map<String, dynamic> query) =>
      _page('/saved-questions', query);
  @override
  Future<Map<String, dynamic>> save(
    String questionId,
    Map<String, dynamic> request,
  ) => _data(_dio.post('/saved-questions/$questionId', data: request));
  @override
  Future<Map<String, dynamic>> updateNote(
    String questionId,
    Map<String, dynamic> request,
  ) => _data(_dio.patch('/saved-questions/$questionId', data: request));
  @override
  Future<Map<String, dynamic>> remove(String questionId) =>
      _data(_dio.delete('/saved-questions/$questionId'));
  @override
  Future<Map<String, dynamic>> createSavedQuiz(Map<String, dynamic> request) =>
      _data(_dio.post('/saved-questions/quiz', data: request));
}

abstract interface class MistakesRepository {
  Future<MistakesPage> list({
    int page = 1,
    int limit = 20,
    String? subjectId,
    String? unitId,
    String? lessonId,
    String? difficulty,
    int minWrongCount = 1,
    bool? mastered,
    bool? reviewed,
    String sort = 'last_wrong_desc',
  });
  Future<MistakeRecord> get(String questionId);
  Future<MistakeReview> markReviewed(String questionId);
  Future<QuizStartResponse> createQuiz(QuizCreateRequest request);
}

final class MistakesApiRepository implements MistakesRepository {
  final ProgressRemoteDataSource _remote;
  MistakesApiRepository(this._remote);

  @override
  Future<MistakesPage> list({
    int page = 1,
    int limit = 20,
    String? subjectId,
    String? unitId,
    String? lessonId,
    String? difficulty,
    int minWrongCount = 1,
    bool? mastered,
    bool? reviewed,
    String sort = 'last_wrong_desc',
  }) async {
    final root = await _remote.listMistakes({
      'page': page,
      'limit': limit,
      'subjectId': ?subjectId,
      'unitId': ?unitId,
      'lessonId': ?lessonId,
      'difficulty': ?difficulty,
      'minWrongCount': minWrongCount,
      'mastered': ?mastered,
      'reviewed': ?reviewed,
      'sort': sort,
    });
    return MistakesPage(
      requireList(root['data'])
          .map((item) => MistakeRecord.fromJson(requireObject(item)))
          .toList(growable: false),
      PageMeta.fromJson(requireObject(root['meta'], 'meta')),
    );
  }

  @override
  Future<MistakeRecord> get(String questionId) async =>
      MistakeRecord.fromJson(await _remote.getMistake(questionId));
  @override
  Future<MistakeReview> markReviewed(String questionId) async =>
      MistakeReview.fromJson(await _remote.markMistakeReviewed(questionId));
  @override
  Future<QuizStartResponse> createQuiz(QuizCreateRequest request) async =>
      QuizStartResponse.fromJson(
        await _remote.createMistakesQuiz(request.toCollectionJson()),
      );
}

abstract interface class SavedQuestionsRepository {
  Future<SavedQuestionsPage> list({
    int page = 1,
    int limit = 20,
    String? subjectId,
    String? unitId,
    String? lessonId,
    String? difficulty,
    String? search,
    String sort = 'saved_desc',
  });
  Future<SavedQuestionRecord> save(String questionId, {String? note});
  Future<SavedQuestionRecord> updateNote(String questionId, String? note);
  Future<SavedQuestionRemoval> remove(String questionId);
  Future<QuizStartResponse> createQuiz(QuizCreateRequest request);
}

final class SavedQuestionsApiRepository implements SavedQuestionsRepository {
  final ProgressRemoteDataSource _remote;
  SavedQuestionsApiRepository(this._remote);

  @override
  Future<SavedQuestionsPage> list({
    int page = 1,
    int limit = 20,
    String? subjectId,
    String? unitId,
    String? lessonId,
    String? difficulty,
    String? search,
    String sort = 'saved_desc',
  }) async {
    final root = await _remote.listSaved({
      'page': page,
      'limit': limit,
      'subjectId': ?subjectId,
      'unitId': ?unitId,
      'lessonId': ?lessonId,
      'difficulty': ?difficulty,
      'search': ?search,
      'sort': sort,
    });
    return SavedQuestionsPage(
      requireList(root['data'])
          .map((item) => SavedQuestionRecord.fromJson(requireObject(item)))
          .toList(growable: false),
      PageMeta.fromJson(requireObject(root['meta'], 'meta')),
    );
  }

  @override
  Future<SavedQuestionRecord> save(String questionId, {String? note}) async =>
      SavedQuestionRecord.fromJson(
        await _remote.save(questionId, {'note': ?note}),
      );
  @override
  Future<SavedQuestionRecord> updateNote(
    String questionId,
    String? note,
  ) async => SavedQuestionRecord.fromJson(
    await _remote.updateNote(questionId, {'note': note}),
  );
  @override
  Future<SavedQuestionRemoval> remove(String questionId) async =>
      SavedQuestionRemoval.fromJson(await _remote.remove(questionId));
  @override
  Future<QuizStartResponse> createQuiz(QuizCreateRequest request) async =>
      QuizStartResponse.fromJson(
        await _remote.createSavedQuiz(request.toCollectionJson()),
      );
}
