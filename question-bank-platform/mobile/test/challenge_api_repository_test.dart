import 'package:app_app/core/network/challenge_api_models.dart';
import 'package:app_app/core/repositories/challenge_api_repository.dart';
import 'package:app_app/features/challenges/services/challenge_socket_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ChallengeApiRepository', () {
    test('matchmaking sends the backend enum and scope', () async {
      final remote = _FakeRemote({
        'data': {
          'matched': true,
          'challenge': {
            'id': 'challenge-1',
            'mode': 'LIGHTNING',
            'status': 'WAITING',
            'questionCount': 10,
            'timePerQuestionSeconds': 30,
            'maxPlayers': 2,
          },
        },
      });
      final result = await ChallengeApiRepository(
        remote,
      ).matchmake(mode: ChallengeMode.lightning, subjectId: 'subject-1');
      expect(remote.path, '/challenges/matchmaking');
      expect(remote.body?['mode'], 'LIGHTNING');
      expect(remote.body?['subjectId'], 'subject-1');
      expect(result.matched, isTrue);
      expect(result.challenge.id, 'challenge-1');
    });

    test('history parses pagination metadata', () async {
      final remote = _FakeRemote({
        'data': <Object?>[],
        'meta': {
          'page': 2,
          'limit': 20,
          'totalItems': 21,
          'totalPages': 2,
          'hasNextPage': false,
          'hasPreviousPage': true,
        },
      });
      final page = await ChallengeApiRepository(
        remote,
      ).list(page: 2, history: true);
      expect(remote.path, '/challenges/history');
      expect(remote.query?['page'], 2);
      expect(page.meta.hasPreviousPage, isTrue);
    });

    test('result keeps server standings and winner', () async {
      final remote = _FakeRemote({
        'data': {
          'challengeId': 'challenge-1',
          'winnerUserId': 'user-1',
          'standings': [
            {
              'id': 'p1',
              'userId': 'user-1',
              'status': 'COMPLETED',
              'score': 120,
              'correctAnswers': 8,
              'wrongAnswers': 2,
            },
          ],
        },
      });
      final result = await ChallengeApiRepository(remote).result('challenge-1');
      expect(remote.path, '/challenges/challenge-1/result');
      expect(result.winnerUserId, 'user-1');
      expect(result.standings.single.score, 120);
    });
  });

  group('Challenge socket contract', () {
    test('parses server round payload without inventing answer data', () {
      final event = ChallengeSocketEvent.parse('challenge:round_completed', {
        'isCorrect': true,
        'pointsEarned': 25,
        'totalScore': 75,
        'responseTimeMs': 1400,
        'challengeCompleted': false,
        'currentSortOrder': 2,
      });
      expect(event?.type, ChallengeSocketEventType.roundCompleted);
      final result = ChallengeRoundResult.fromJson(event!.data);
      expect(result.totalScore, 75);
      expect(result.isCorrect, isTrue);
      expect(event.data.containsKey('correctOptionId'), isFalse);
    });

    test('ignores unknown and malformed events', () {
      expect(ChallengeSocketEvent.parse('challenge:unknown', {}), isNull);
      expect(ChallengeSocketEvent.parse('challenge:state', 'invalid'), isNull);
    });
  });
}

class _FakeRemote implements ChallengeRemoteDataSource {
  final Object? response;
  String? path;
  Map<String, dynamic>? body;
  Map<String, dynamic>? query;
  _FakeRemote(this.response);

  @override
  Future<Object?> get(String path, {Map<String, dynamic>? query}) async {
    this.path = path;
    this.query = query;
    return response;
  }

  @override
  Future<Object?> post(String path, {Map<String, dynamic>? data}) async {
    this.path = path;
    body = data;
    return response;
  }
}
