import 'package:flutter_test/flutter_test.dart';
import 'package:app_app/core/errors/api_exception.dart';
import 'package:app_app/core/network/quiz_api_models.dart';
import 'package:app_app/features/quiz/providers/quiz_provider.dart';
import 'package:app_app/core/repositories/quiz_api_repository.dart';

void main() {
  group('Quiz API contract', () {
    test('backend quiz error codes map to clear Arabic messages', () {
      expect(
        quizErrorMessage(const Conflict(code: 'QUESTION_ALREADY_ANSWERED')),
        'تم إرسال إجابة مختلفة لهذا السؤال مسبقًا.',
      );
      expect(
        quizErrorMessage(
          const ValidationFailure(code: 'QUIZ_ANSWER_TYPE_INVALID'),
        ),
        'صيغة الإجابة غير متوافقة مع نوع السؤال.',
      );
      expect(
        quizErrorMessage(const ValidationFailure(code: 'QUIZ_ATTEMPT_EXPIRED')),
        'انتهى وقت الاختبار.',
      );
    });
    test('student question parser does not retain answer keys', () {
      final question = QuizQuestion.fromJson({
        'id': 'q1',
        'subjectId': 's1',
        'type': 'MULTIPLE_CHOICE',
        'difficulty': 'MEDIUM',
        'questionText': 'Question',
        'correctBoolean': true,
        'correctOptionId': 'o1',
        'fingerprint': 'internal',
        'options': [
          {'id': 'o1', 'optionText': 'A', 'isCorrect': true, 'whyWrong': null},
          {'id': 'o2', 'optionText': 'B', 'isCorrect': false, 'whyWrong': 'x'},
        ],
      });

      expect(question.options, {'o1': 'A', 'o2': 'B'});
      expect(question.options.values.join(), isNot(contains('true')));
      expect(question.questionText, 'Question');
    });

    test('create request sends only identifiers compatible with scope', () {
      final request = _request(
        scope: 'LESSON',
        subjectId: 'ignored-subject',
        unitId: 'ignored-unit',
        lessonId: 'lesson-id',
        examModelId: 'ignored-exam',
      ).toJson();

      expect(request['lessonId'], 'lesson-id');
      expect(request, isNot(contains('subjectId')));
      expect(request, isNot(contains('unitId')));
      expect(request, isNot(contains('examModelId')));
      expect(request['eliminationEnabled'], isFalse);
    });

    test(
      'partial attempt exposes server shortage without local fallback',
      () async {
        final remote = _FakeQuizRemote()..createResponse = _startJson();
        final result = await QuizApiRepository(
          remote,
        ).create(_request(scope: 'SUBJECT', subjectId: 's1'));

        expect(result.questions, hasLength(1));
        expect(result.availability.requestedQuestionCount, 3);
        expect(result.availability.selectedCount, 1);
        expect(result.availability.shortageCount, 2);
        expect(result.availability.isPartial, isTrue);
        expect(result.availability.warningCode, 'INSUFFICIENT_QUESTIONS');
      },
    );

    test(
      'identical answer retries produce identical backend requests',
      () async {
        final remote = _FakeQuizRemote();
        final repository = QuizApiRepository(remote);
        final question = QuizQuestion.fromJson(
          (_startJson()['questions'] as List).single as Map<String, dynamic>,
        );

        for (var i = 0; i < 2; i++) {
          await repository.answer(
            'attempt-1',
            question: question,
            selection: 'o1',
            timeSpentMs: 1200,
            hintUsed: false,
            eliminatedOptionUsed: false,
          );
        }

        expect(remote.answerRequests, hasLength(2));
        expect(remote.answerRequests[0], remote.answerRequests[1]);
        expect(remote.answerRequests[0]['selectedOptionId'], 'o1');
        expect(remote.answerRequests[0], isNot(contains('isCorrect')));
      },
    );

    test('result values are parsed from the server summary', () async {
      final remote = _FakeQuizRemote();
      final result = await QuizApiRepository(remote).getResult('attempt-1');

      expect(result.summary.correctCount, 1);
      expect(result.summary.wrongCount, 1);
      expect(result.summary.scorePercent, 50);
      expect(result.answeredCount, 2);
      expect(result.durationSeconds, 42);
      expect(result.pointsEarned, 15);
      expect(result.weaknesses, ['lesson-weak']);
      expect(result.breakdowns.difficulties.single.key, 'MEDIUM');
      expect(result.wrongQuestions.single.isCorrect, isFalse);
      expect(result.wrongQuestions.single.correctOptionId, 'o1');
    });
  });
}

QuizCreateRequest _request({
  required String scope,
  String? subjectId,
  String? unitId,
  String? lessonId,
  String? examModelId,
}) => QuizCreateRequest(
  scope: scope,
  subjectId: subjectId,
  unitId: unitId,
  lessonId: lessonId,
  examModelId: examModelId,
  questionCount: 3,
  difficulty: 'MIXED',
  timingMode: 'NONE',
  heartsEnabled: false,
  initialHearts: 3,
  hintsEnabled: true,
  eliminationEnabled: false,
  explanationMode: 'AFTER_EACH',
  excludeMastered: false,
  unansweredOnly: false,
);

Map<String, dynamic> _attemptJson({String status = 'IN_PROGRESS'}) => {
  'id': 'attempt-1',
  'scope': 'SUBJECT',
  'status': status,
  'subjectId': 's1',
  'questionCount': 3,
  'correctCount': 1,
  'wrongCount': 1,
  'unansweredCount': 1,
  'scorePercent': 50,
  'pointsEarned': 15,
  'startedAt': '2026-01-01T00:00:00.000Z',
  'lastActivityAt': '2026-01-01T00:00:42.000Z',
  'settings': {'timingMode': 'NONE', 'explanationMode': 'AFTER_EACH'},
};

Map<String, dynamic> _startJson() => {
  'attempt': _attemptJson(),
  'questions': [
    {
      'id': 'q1',
      'subjectId': 's1',
      'type': 'MULTIPLE_CHOICE',
      'difficulty': 'MEDIUM',
      'questionText': 'Question',
      'options': [
        {'id': 'o1', 'optionText': 'A'},
        {'id': 'o2', 'optionText': 'B'},
      ],
    },
  ],
  'availability': {
    'requestedQuestionCount': 3,
    'actualQuestionCount': 1,
    'shortageCount': 2,
    'warningCode': 'INSUFFICIENT_QUESTIONS',
  },
};

final class _FakeQuizRemote implements QuizRemoteDataSource {
  Map<String, dynamic> createResponse = _startJson();
  final List<Map<String, dynamic>> answerRequests = [];

  @override
  Future<Map<String, dynamic>> create(Map<String, dynamic> request) async =>
      createResponse;
  @override
  Future<Map<String, dynamic>> getAttempt(String id) async => _startJson();
  @override
  Future<Map<String, dynamic>> submitAnswer(
    String id,
    Map<String, dynamic> request,
  ) async {
    answerRequests.add(Map<String, dynamic>.from(request));
    return {
      'accepted': true,
      'isCorrect': true,
      'correctAnswer': {'optionId': 'o1'},
      'explanation': {'short': 'Short', 'detailed': 'Detailed'},
      'score': {'pointsEarned': 5, 'attemptPoints': 15},
      'progress': {
        'answered': 2,
        'remaining': 1,
        'correct': 1,
        'wrong': 1,
        'status': 'IN_PROGRESS',
      },
    };
  }

  @override
  Future<Map<String, dynamic>> complete(String id) async =>
      _attemptJson(status: 'COMPLETED');
  @override
  Future<Map<String, dynamic>> abandon(String id) async =>
      _attemptJson(status: 'ABANDONED');
  @override
  Future<Map<String, dynamic>> result(String id) async => {
    'summary': {
      ..._attemptJson(status: 'COMPLETED'),
      'answeredCount': 2,
      'durationSeconds': 42,
    },
    'breakdowns': {
      'subject': <dynamic>[],
      'unit': <dynamic>[],
      'lesson': <dynamic>[],
      'difficulty': [
        {'key': 'MEDIUM', 'answered': 2, 'correct': 1, 'wrong': 1},
      ],
      'questionType': <dynamic>[],
    },
    'analysis': {
      'strengths': ['lesson-strong'],
      'weaknesses': ['lesson-weak'],
      'recommendedLessons': ['lesson-next'],
      'slowQuestions': <dynamic>[],
      'wrongQuestions': [
        {
          ...(_startJson()['questions'] as List).single as Map<String, dynamic>,
          'answered': true,
          'selectedOptionId': 'o2',
          'isCorrect': false,
          'pointsEarned': 0,
          'timeSpentMs': 1000,
          'options': [
            {'id': 'o1', 'optionText': 'A', 'isCorrect': true},
            {'id': 'o2', 'optionText': 'B', 'isCorrect': false},
          ],
        },
      ],
      'unansweredQuestions': <dynamic>[],
    },
    'questions': <dynamic>[],
    'gamification': {'points': 15, 'achievementsUnlocked': <dynamic>[]},
  };
  @override
  Future<Map<String, dynamic>> history(Map<String, dynamic> query) async => {
    'data': [_attemptJson()],
    'meta': _meta(),
  };
}

Map<String, dynamic> _meta() => {
  'page': 1,
  'limit': 20,
  'totalItems': 1,
  'totalPages': 1,
  'hasNextPage': false,
  'hasPreviousPage': false,
};
