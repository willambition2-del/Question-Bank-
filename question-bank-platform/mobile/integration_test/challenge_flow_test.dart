import 'package:app_app/core/network/challenge_api_models.dart';
import 'package:app_app/core/network/dio_client.dart';
import 'package:app_app/core/repositories/auth_api_repository.dart';
import 'package:app_app/core/repositories/challenge_api_repository.dart';
import 'package:app_app/core/storage/token_storage.dart';
import 'package:app_app/features/challenges/services/challenge_socket_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

const usernameA = String.fromEnvironment('API_TEST_USERNAME_A');
const passwordA = String.fromEnvironment('API_TEST_PASSWORD_A');
const usernameB = String.fromEnvironment('API_TEST_USERNAME_B');
const passwordB = String.fromEnvironment('API_TEST_PASSWORD_B');

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'two-user challenge REST and socket reconnect flow',
    (tester) async {
      final tokensA = _MemoryTokenStorage();
      final tokensB = _MemoryTokenStorage();
      final authA = AuthApiRepository(
        DioClient(tokenStorage: tokensA).dio,
        tokensA,
      );
      final authB = AuthApiRepository(
        DioClient(tokenStorage: tokensB).dio,
        tokensB,
      );
      final userA = await authA.login(usernameA, passwordA);
      final userB = await authB.login(usernameB, passwordB);
      expect(userA, isNotNull);
      expect(userB, isNotNull);

      final apiA = ChallengeApiRepository(
        DioChallengeRemoteDataSource(DioClient(tokenStorage: tokensA).dio),
      );
      final apiB = ChallengeApiRepository(
        DioChallengeRemoteDataSource(DioClient(tokenStorage: tokensB).dio),
      );
      final socketA = ChallengeSocketService(tokensA);
      final socketB = ChallengeSocketService(tokensB);
      String? challengeId;
      try {
        final challenge = await apiA.create(
          mode: ChallengeMode.oneVsOne,
          questionCount: 1,
          timePerQuestionSeconds: 30,
        );
        challengeId = challenge.id;
        await apiA.invite(challenge.id, userB!.id);
        await apiB.accept(challenge.id);

        await socketA.connect();
        await socketB.connect();
        await Future.wait([
          socketA.statuses
              .firstWhere((status) => status == ChallengeSocketStatus.connected)
              .timeout(const Duration(seconds: 15)),
          socketB.statuses
              .firstWhere((status) => status == ChallengeSocketStatus.connected)
              .timeout(const Duration(seconds: 15)),
        ]);
        socketA.join(challenge.id);
        socketB.join(challenge.id);
        socketA.ready(challenge.id);
        socketB.ready(challenge.id);

        final stateEvent = await socketA.events
            .firstWhere(
              (event) =>
                  event.type == ChallengeSocketEventType.state ||
                  event.type == ChallengeSocketEventType.countdown ||
                  event.type == ChallengeSocketEventType.started ||
                  event.type == ChallengeSocketEventType.question,
            )
            .timeout(const Duration(seconds: 30));
        expect(stateEvent.data, isNotEmpty);

        socketA.disconnect();
        await socketA.connect();
        await socketA.statuses
            .firstWhere((status) => status == ChallengeSocketStatus.connected)
            .timeout(const Duration(seconds: 15));
        socketA.join(challenge.id);
        socketA.sync(challenge.id);
        await apiA.get(challenge.id);
      } finally {
        socketA.dispose();
        socketB.dispose();
        if (challengeId != null) {
          try {
            await apiA.cancel(challengeId);
          } catch (_) {
            // The server may already have completed or cancelled the test match.
          }
        }
        await authA.logout();
        await authB.logout();
      }
    },
    skip:
        usernameA.isEmpty ||
        passwordA.isEmpty ||
        usernameB.isEmpty ||
        passwordB.isEmpty,
  );
}

final class _MemoryTokenStorage implements TokenStorage {
  TokenPair? _tokens;

  @override
  Future<void> clear() async => _tokens = null;

  @override
  Future<String?> readAccessToken() async => _tokens?.accessToken;

  @override
  Future<String?> readRefreshToken() async => _tokens?.refreshToken;

  @override
  Future<void> write(TokenPair tokens) async => _tokens = tokens;
}
