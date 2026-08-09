import 'dart:async';

import 'package:app_app/core/network/challenge_api_models.dart';
import 'package:app_app/core/repositories/challenge_api_repository.dart';
import 'package:app_app/core/repositories/providers.dart';
import 'package:app_app/core/storage/token_storage.dart';
import 'package:app_app/features/challenges/providers/challenge_provider.dart';
import 'package:app_app/features/challenges/services/challenge_socket_service.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'challenge provider uses REST then socket and accepts server countdown',
    () async {
      final remote = _ChallengeRemote();
      final socket = _ChallengeSocket();
      final container = ProviderContainer(
        overrides: [
          challengeRemoteDataSourceProvider.overrideWithValue(remote),
          challengeSocketServiceProvider.overrideWithValue(socket),
        ],
      );
      addTearDown(() {
        container.dispose();
        socket.close();
      });

      await container
          .read(challengeProvider.notifier)
          .searchOpponent(appChallengeModeOneVsOne, subjectId: 'subject-1');
      expect(remote.path, '/challenges/matchmaking');
      expect(socket.joinedId, 'challenge-1');
      expect(socket.readyId, 'challenge-1');

      socket.add('challenge:countdown', {'seconds': 3});
      await Future<void>.delayed(Duration.zero);
      expect(container.read(challengeProvider).status, 'countdown');
      expect(container.read(challengeProvider).countdownSeconds, 3);
    },
  );

  test(
    'challenge provider exposes REST errors without local fallback',
    () async {
      final socket = _ChallengeSocket();
      final container = ProviderContainer(
        overrides: [
          challengeRemoteDataSourceProvider.overrideWithValue(
            _FailingChallengeRemote(),
          ),
          challengeSocketServiceProvider.overrideWithValue(socket),
        ],
      );
      addTearDown(() {
        container.dispose();
        socket.close();
      });

      await container
          .read(challengeProvider.notifier)
          .searchOpponent(appChallengeModeOneVsOne);
      final state = container.read(challengeProvider);
      expect(state.status, 'error');
      expect(state.errorMessage, contains('backend unavailable'));
      expect(socket.joinedId, isNull);
    },
  );
}

const appChallengeModeOneVsOne = ChallengeMode.oneVsOne;

class _ChallengeRemote implements ChallengeRemoteDataSource {
  String? path;
  @override
  Future<Object?> get(String path, {Map<String, dynamic>? query}) async =>
      throw UnimplementedError();
  @override
  Future<Object?> post(String path, {Map<String, dynamic>? data}) async {
    this.path = path;
    return {
      'data': {
        'matched': true,
        'challenge': {
          'id': 'challenge-1',
          'mode': 'ONE_VS_ONE',
          'status': 'WAITING',
          'subjectId': 'subject-1',
          'questionCount': 10,
          'timePerQuestionSeconds': 30,
          'maxPlayers': 2,
        },
      },
    };
  }
}

class _FailingChallengeRemote implements ChallengeRemoteDataSource {
  @override
  Future<Object?> get(String path, {Map<String, dynamic>? query}) async =>
      throw StateError('backend unavailable');
  @override
  Future<Object?> post(String path, {Map<String, dynamic>? data}) async =>
      throw StateError('backend unavailable');
}

class _ChallengeSocket extends ChallengeSocketService {
  _ChallengeSocket() : super(_TestTokens());
  final controller = StreamController<ChallengeSocketEvent>.broadcast();
  String? joinedId;
  String? readyId;
  @override
  Stream<ChallengeSocketEvent> get events => controller.stream;
  @override
  Stream<ChallengeSocketStatus> get statuses => const Stream.empty();
  @override
  ChallengeSocketStatus get status => ChallengeSocketStatus.connected;
  @override
  String? get userId => 'user-1';
  @override
  Future<void> connect() async {}
  @override
  void join(String challengeId) => joinedId = challengeId;
  @override
  void ready(String challengeId) => readyId = challengeId;
  @override
  void sync(String challengeId) {}
  @override
  void heartbeat(String challengeId) {}
  @override
  void disconnect() {}
  void add(String name, Map<String, dynamic> data) =>
      controller.add(ChallengeSocketEvent.parse(name, data)!);
  void close() => controller.close();
}

class _TestTokens implements TokenStorage {
  @override
  Future<void> clear() async {}
  @override
  Future<String?> readAccessToken() async => 'token';
  @override
  Future<String?> readRefreshToken() async => null;
  @override
  Future<void> write(TokenPair tokens) async {}
}
