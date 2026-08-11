import 'package:flutter_test/flutter_test.dart';
import 'package:app_app/core/repositories/progress_api_repositories.dart';
import 'package:app_app/core/repositories/quiz_api_repository.dart';

void main() {
  group('Progress collections API contract', () {
    test('mistakes list maps safe records and pagination', () async {
      final remote = _FakeProgressRemote();
      final page = await MistakesApiRepository(remote).list(
        page: 2,
        limit: 10,
        subjectId: 'subject-1',
        minWrongCount: 2,
        reviewed: false,
      );

      expect(remote.lastMistakesQuery, containsPair('page', 2));
      expect(remote.lastMistakesQuery, containsPair('subjectId', 'subject-1'));
      expect(remote.lastMistakesQuery, containsPair('minWrongCount', 2));
      expect(remote.lastMistakesQuery, containsPair('reviewed', false));
      expect(page.items.single.wrongCount, 3);
      expect(page.items.single.question.options, {'o1': 'A', 'o2': 'B'});
      expect(page.meta.totalItems, 11);
      expect(page.meta.hasNextPage, isFalse);
    });

    test('mark reviewed does not infer calculated mastery', () async {
      final review = await MistakesApiRepository(
        _FakeProgressRemote(),
      ).markReviewed('q1');

      expect(review.reviewed, isTrue);
      expect(review.isMastered, isFalse);
    });

    test(
      'saved note update and idempotent delete use server responses',
      () async {
        final remote = _FakeProgressRemote();
        final repository = SavedQuestionsApiRepository(remote);

        final updated = await repository.updateNote('q1', '  note  ');
        final removed = await repository.remove('q1');
        final removedAgain = await repository.remove('q1');

        expect(remote.lastNoteRequest, {'note': '  note  '});
        expect(updated.note, 'note');
        expect(removed.removed, isTrue);
        expect(removedAgain.removed, isFalse);
      },
    );

    test(
      'collection quiz body omits scope and exam model identifiers',
      () async {
        final remote = _FakeProgressRemote();
        await SavedQuestionsApiRepository(remote).createQuiz(
          QuizCreateRequest(
            scope: 'SAVED',
            subjectId: 'subject-1',
            examModelId: 'must-not-be-sent',
            questionCount: 10,
            difficulty: 'MIXED',
            timingMode: 'NONE',
            heartsEnabled: false,
            initialHearts: 3,
            hintsEnabled: true,
            eliminationEnabled: false,
            explanationMode: 'AFTER_EACH',
            excludeMastered: false,
            unansweredOnly: false,
          ),
        );

        expect(remote.lastQuizRequest, containsPair('subjectId', 'subject-1'));
        expect(remote.lastQuizRequest, isNot(contains('scope')));
        expect(remote.lastQuizRequest, isNot(contains('examModelId')));
      },
    );
  });
}

final class _FakeProgressRemote implements ProgressRemoteDataSource {
  Map<String, dynamic> lastMistakesQuery = {};
  Map<String, dynamic> lastNoteRequest = {};
  Map<String, dynamic> lastQuizRequest = {};
  var removeCalls = 0;

  @override
  Future<Map<String, dynamic>> listMistakes(Map<String, dynamic> query) async {
    lastMistakesQuery = Map<String, dynamic>.from(query);
    return {
      'data': [
        {
          'question': _question(),
          'attemptsCount': 4,
          'correctCount': 1,
          'wrongCount': 3,
          'consecutiveWrong': 2,
          'masteryScore': 0.25,
          'isMastered': false,
          'reviewed': false,
          'lastAnsweredAt': '2026-01-02T00:00:00.000Z',
          'lastTimeMs': 900,
        },
      ],
      'meta': {
        'page': 2,
        'limit': 10,
        'totalItems': 11,
        'totalPages': 2,
        'hasNextPage': false,
        'hasPreviousPage': true,
      },
    };
  }

  @override
  Future<Map<String, dynamic>> getMistake(String questionId) async => {
    'question': _question(),
    'attemptsCount': 4,
    'correctCount': 1,
    'wrongCount': 3,
    'consecutiveWrong': 2,
    'masteryScore': 0.25,
    'isMastered': false,
    'reviewed': false,
  };

  @override
  Future<Map<String, dynamic>> markMistakeReviewed(String questionId) async => {
    'questionId': questionId,
    'reviewStatus': 'REVIEWED',
    'manualReviewedAt': '2026-01-03T00:00:00.000Z',
    'isMastered': false,
  };

  @override
  Future<Map<String, dynamic>> createMistakesQuiz(
    Map<String, dynamic> request,
  ) async {
    lastQuizRequest = Map<String, dynamic>.from(request);
    return _start();
  }

  @override
  Future<Map<String, dynamic>> listSaved(Map<String, dynamic> query) async => {
    'data': [_saved()],
    'meta': {
      'page': 1,
      'limit': 20,
      'totalItems': 1,
      'totalPages': 1,
      'hasNextPage': false,
      'hasPreviousPage': false,
    },
  };

  @override
  Future<Map<String, dynamic>> save(
    String questionId,
    Map<String, dynamic> request,
  ) async => _saved(note: request['note']?.toString());

  @override
  Future<Map<String, dynamic>> updateNote(
    String questionId,
    Map<String, dynamic> request,
  ) async {
    lastNoteRequest = Map<String, dynamic>.from(request);
    return _saved(note: request['note']?.toString().trim());
  }

  @override
  Future<Map<String, dynamic>> remove(String questionId) async {
    removeCalls += 1;
    return {'questionId': questionId, 'removed': removeCalls == 1};
  }

  @override
  Future<Map<String, dynamic>> createSavedQuiz(
    Map<String, dynamic> request,
  ) async {
    lastQuizRequest = Map<String, dynamic>.from(request);
    return _start();
  }
}

Map<String, dynamic> _question() => {
  'id': 'q1',
  'subjectId': 'subject-1',
  'type': 'MULTIPLE_CHOICE',
  'difficulty': 'MEDIUM',
  'questionText': 'Question',
  'correctOptionId': 'o1',
  'options': [
    {'id': 'o1', 'optionText': 'A', 'isCorrect': true},
    {'id': 'o2', 'optionText': 'B', 'isCorrect': false},
  ],
};

Map<String, dynamic> _saved({String? note = 'note'}) => {
  'id': 'saved-1',
  'question': _question(),
  'note': note,
  'savedAt': '2026-01-01T00:00:00.000Z',
  'updatedAt': '2026-01-02T00:00:00.000Z',
};

Map<String, dynamic> _start() => {
  'attempt': {
    'id': 'attempt-1',
    'scope': 'SAVED',
    'status': 'IN_PROGRESS',
    'questionCount': 1,
    'correctCount': 0,
    'wrongCount': 0,
    'unansweredCount': 1,
    'scorePercent': 0,
    'pointsEarned': 0,
    'startedAt': '2026-01-01T00:00:00.000Z',
    'lastActivityAt': '2026-01-01T00:00:00.000Z',
    'settings': {'timingMode': 'NONE', 'explanationMode': 'AFTER_EACH'},
  },
  'questions': [_question()],
  'availability': {
    'requestedQuestionCount': 1,
    'actualQuestionCount': 1,
    'shortageCount': 0,
    'warningCode': null,
  },
};
