import 'dart:typed_data';

import 'package:app_app/core/errors/api_exception.dart';
import 'package:app_app/core/repositories/providers.dart';
import 'package:app_app/features/assistant/data/assistant_remote_data_source.dart';
import 'package:app_app/features/assistant/domain/assistant_models.dart';
import 'package:app_app/features/assistant/domain/assistant_repository.dart';
import 'package:app_app/features/assistant/providers/assistant_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Assistant public contract', () {
    test('parses only student-safe fields', () {
      final response = AssistantResponse.fromJson({
        'requestId': 'request-1',
        'status': 'COMPLETED',
        'summary': 'Safe explanation',
        'steps': ['First', 'Second'],
        'keyConcept': 'Concept',
        'commonMistake': null,
        'sourceReferences': [
          {'documentId': 'document-1', 'pageNumber': 3, 'title': 'Reference'},
        ],
        'usage': {'remainingToday': 4},
        'providerId': 'must-not-be-retained',
        'modelId': 'must-not-be-retained',
        'routingPolicy': {'internal': true},
      });

      expect(response.summary, 'Safe explanation');
      expect(response.sources.single.title, 'Reference');
      expect(response.remainingToday, 4);
      expect(
        response.toString().toLowerCase(),
        isNot(anyOf(contains('provider'), contains('routing'))),
      );
    });

    test('mobile requests never include infrastructure controls', () async {
      final remote = _RecordingRemote();
      final repository = AssistantApiRepository(remote);

      await repository.chat('  explain this  ');
      await repository.questionHint(
        questionId: 'question-1',
        attemptId: 'attempt-1',
      );
      await repository.summarizeLesson('lesson-1');

      expect(remote.calls[0].$1, '/assistant/chat');
      expect(remote.calls[0].$2, {'message': 'explain this'});
      expect(remote.calls[1].$1, '/assistant/questions/question-1/hint');
      expect(remote.calls[1].$2, {'attemptId': 'attempt-1'});
      expect(remote.calls[2].$1, '/assistant/lessons/lesson-1/summarize');
      expect(remote.calls[2].$2, isEmpty);
      final serialized = remote.calls.toString().toLowerCase();
      expect(serialized, isNot(contains('provider')));
      expect(serialized, isNot(contains('model')));
      expect(serialized, isNot(contains('routing')));
      expect(serialized, isNot(contains('api_key')));
    });

    test('insufficient context maps to a dedicated state', () async {
      final container = ProviderContainer(
        overrides: [
          assistantRepositoryProvider.overrideWithValue(
            _FakeRepository(response: _response(hasSufficientContext: false)),
          ),
        ],
      );
      addTearDown(container.dispose);

      await container.read(assistantProvider.notifier).chat('question');

      expect(
        container.read(assistantProvider).status,
        AssistantUiStatus.insufficientContext,
      );
    });

    test('usage limit and temporary outage are generic states', () async {
      for (final scenario in [
        (
          const RateLimited(code: 'LIMIT_REACHED'),
          AssistantUiStatus.limitReached,
        ),
        (
          const ServerFailure(statusCode: 503),
          AssistantUiStatus.temporarilyUnavailable,
        ),
      ]) {
        final container = ProviderContainer(
          overrides: [
            assistantRepositoryProvider.overrideWithValue(
              _FakeRepository(error: scenario.$1),
            ),
          ],
        );
        await container.read(assistantProvider.notifier).chat('question');
        expect(container.read(assistantProvider).status, scenario.$2);
        expect(
          container.read(assistantProvider).errorMessage!.toLowerCase(),
          isNot(anyOf(contains('provider'), contains('model'))),
        );
        container.dispose();
      }
    });
  });
}

AssistantResponse _response({bool hasSufficientContext = true}) =>
    AssistantResponse(
      requestId: 'request-1',
      hasSufficientContext: hasSufficientContext,
      summary: 'Answer',
      steps: const [],
      keyConcept: null,
      commonMistake: null,
      sources: const [],
      remainingToday: 5,
    );

final class _RecordingRemote implements AssistantRemoteDataSource {
  final List<(String, Map<String, dynamic>)> calls = [];

  @override
  Future<Map<String, dynamic>> postImage({
    required Uint8List bytes,
    required String fileName,
    required ImageAnalysisMode mode,
    String? userQuestion,
    void Function(int sent, int total)? onSendProgress,
  }) async {
    onSendProgress?.call(bytes.length, bytes.length);
    return {
      'requestId': 'image-request',
      'detectedText': 'Question',
      'normalizedQuestion': 'Question',
      'detectedOptions': <String>[],
      'analysisMode': mode.wireName,
      'solutionSteps': <String>[],
      'confidence': 0.9,
      'requiresClarification': false,
      'warnings': <String>[],
      'usageStatus': {'remainingToday': 4},
    };
  }

  @override
  Future<Map<String, dynamic>> post(
    String path, [
    Map<String, dynamic> body = const {},
  ]) async {
    calls.add((path, body));
    return {
      'requestId': 'request-1',
      'status': 'COMPLETED',
      'summary': 'Answer',
      'steps': <String>[],
      'keyConcept': null,
      'commonMistake': null,
      'sourceReferences': <Object>[],
      'usage': {'remainingToday': 5},
    };
  }

  @override
  Future<Map<String, dynamic>> get(String path) async {
    calls.add((path, const {}));
    return {
      'status': 'OK',
      'remainingToday': 5,
      'dailyLimit': 10,
    };
  }
}

final class _FakeRepository implements AssistantRepository {
  final AssistantResponse? response;
  final Object? error;

  const _FakeRepository({this.response, this.error});

  Future<AssistantResponse> _result() async {
    if (error != null) throw error!;
    return response ?? _response();
  }

  @override
  Future<AssistantUsageInfo> getUsage() async {
    return const AssistantUsageInfo(
      enabled: true,
      limit: 10,
      used: 5,
      remaining: 5,
      resetPeriod: 'DAILY',
      resetAt: '2026-08-18T00:00:00Z',
    );
  }

  @override
  Future<ImageQuestionAnalysisResponse> analyzeQuestionImage({
    required Uint8List bytes,
    required String fileName,
    required ImageAnalysisMode mode,
    String? userQuestion,
    void Function(int sent, int total)? onSendProgress,
  }) => throw UnimplementedError();
  @override
  Future<AssistantResponse> chat(String message) => _result();

  @override
  Future<AssistantResponse> questionHint({
    required String questionId,
    required String attemptId,
  }) => _result();

  @override
  Future<AssistantResponse> explainQuestion({
    required String questionId,
    required String attemptId,
  }) => _result();

  @override
  Future<AssistantResponse> reviewAnswer({
    required String questionId,
    required String attemptId,
  }) => _result();

  @override
  Future<AssistantResponse> summarizeLesson(String lessonId) => _result();

  @override
  Future<AssistantResponse> simplifyLesson(String lessonId) => _result();

  @override
  Future<AssistantResponse> askKnowledge({
    required String question,
    required String knowledgeBaseId,
    String? subjectId,
    String? unitId,
    String? lessonId,
  }) => _result();
}
