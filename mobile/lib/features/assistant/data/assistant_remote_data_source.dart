import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../../../core/network/api_call.dart';
import '../../../core/network/api_response.dart';
import '../domain/assistant_models.dart';
import '../domain/assistant_repository.dart';

abstract interface class AssistantRemoteDataSource {
  Future<Map<String, dynamic>> postImage({
    required Uint8List bytes,
    required String fileName,
    required ImageAnalysisMode mode,
    String? userQuestion,
    void Function(int sent, int total)? onSendProgress,
  });
  Future<Map<String, dynamic>> post(
    String path, [
    Map<String, dynamic> body = const {},
  ]);
}

final class DioAssistantRemoteDataSource implements AssistantRemoteDataSource {
  final Dio _dio;

  DioAssistantRemoteDataSource(this._dio);

  @override
  Future<Map<String, dynamic>> postImage({
    required Uint8List bytes,
    required String fileName,
    required ImageAnalysisMode mode,
    String? userQuestion,
    void Function(int sent, int total)? onSendProgress,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/assistant/images/analyze-question',
        data: FormData.fromMap({
          'image': MultipartFile.fromBytes(bytes, filename: fileName),
          'analysisMode': mode.wireName,
          if (userQuestion?.trim().isNotEmpty == true)
            'userQuestion': userQuestion!.trim(),
        }),
        onSendProgress: onSendProgress,
      );
      return requireObject(requireObject(response.data)['data']);
    } on DioException catch (error) {
      throwApiError(error);
    }
  }

  @override
  Future<Map<String, dynamic>> post(
    String path, [
    Map<String, dynamic> body = const {},
  ]) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(path, data: body);
      return requireObject(requireObject(response.data)['data']);
    } on DioException catch (error) {
      throwApiError(error);
    }
  }
}

final class AssistantApiRepository implements AssistantRepository {
  final AssistantRemoteDataSource _remote;

  AssistantApiRepository(this._remote);

  @override
  Future<ImageQuestionAnalysisResponse> analyzeQuestionImage({
    required Uint8List bytes,
    required String fileName,
    required ImageAnalysisMode mode,
    String? userQuestion,
    void Function(int sent, int total)? onSendProgress,
  }) async => ImageQuestionAnalysisResponse.fromJson(
    await _remote.postImage(
      bytes: bytes,
      fileName: fileName,
      mode: mode,
      userQuestion: userQuestion,
      onSendProgress: onSendProgress,
    ),
  );
  @override
  Future<AssistantResponse> chat(String message) =>
      _send('/assistant/chat', {'message': message.trim()});

  @override
  Future<AssistantResponse> questionHint({
    required String questionId,
    required String attemptId,
  }) =>
      _send('/assistant/questions/$questionId/hint', {'attemptId': attemptId});

  @override
  Future<AssistantResponse> explainQuestion({
    required String questionId,
    required String attemptId,
  }) => _send('/assistant/questions/$questionId/explain', {
    'attemptId': attemptId,
  });

  @override
  Future<AssistantResponse> reviewAnswer({
    required String questionId,
    required String attemptId,
  }) => _send('/assistant/questions/$questionId/review-answer', {
    'attemptId': attemptId,
  });

  @override
  Future<AssistantResponse> summarizeLesson(String lessonId) =>
      _send('/assistant/lessons/$lessonId/summarize');

  @override
  Future<AssistantResponse> simplifyLesson(String lessonId) =>
      _send('/assistant/lessons/$lessonId/simplify');

  @override
  Future<AssistantResponse> askKnowledge({
    required String question,
    required String knowledgeBaseId,
    String? subjectId,
    String? unitId,
    String? lessonId,
  }) => _send('/assistant/knowledge/ask', {
    'question': question.trim(),
    'knowledgeBaseId': knowledgeBaseId,
    if (subjectId != null) 'subjectId': subjectId,
    if (unitId != null) 'unitId': unitId,
    if (lessonId != null) 'lessonId': lessonId,
  });

  Future<AssistantResponse> _send(
    String path, [
    Map<String, dynamic> body = const {},
  ]) async => AssistantResponse.fromJson(await _remote.post(path, body));
}
