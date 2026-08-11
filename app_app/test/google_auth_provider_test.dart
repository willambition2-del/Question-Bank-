import 'package:app_app/core/errors/api_exception.dart';
import 'package:app_app/core/models/companion_enums.dart';
import 'package:app_app/core/models/student_model.dart';
import 'package:app_app/core/repositories/interfaces.dart';
import 'package:app_app/core/repositories/providers.dart';
import 'package:app_app/features/auth/providers/auth_provider.dart';
import 'package:app_app/features/auth/services/google_sign_in_service.dart';
import 'package:app_app/features/challenges/services/challenge_socket_service.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'successful Google login updates the authenticated Riverpod state',
    () async {
      final repository = _FakeAuthRepository(
        googleSession: GoogleAuthSession(user: _student, isNewUser: true),
      );
      final gateway = _FakeGoogleGateway(
        const GoogleIdentityToken('google-id-token'),
      );
      final container = ProviderContainer(
        overrides: [
          authRepositoryProvider.overrideWithValue(repository),
          googleSignInGatewayProvider.overrideWithValue(gateway),
        ],
      );
      addTearDown(container.dispose);

      final outcome = await container
          .read(authProvider.notifier)
          .loginWithGoogle();

      expect(outcome.succeeded, isTrue);
      expect(outcome.isNewUser, isTrue);
      expect(repository.receivedIdToken, 'google-id-token');
      expect(container.read(authProvider)?.id, _student.id);
      expect(
        container.read(authSessionStatusProvider),
        AuthSessionStatus.authenticated,
      );
      expect(
        container.read(googleAuthStateProvider).status,
        GoogleAuthStatus.success,
      );
    },
  );

  test('Google cancellation is silent and never calls the backend', () async {
    final repository = _FakeAuthRepository();
    final container = ProviderContainer(
      overrides: [
        authRepositoryProvider.overrideWithValue(repository),
        googleSignInGatewayProvider.overrideWithValue(
          _FakeGoogleGateway(const GoogleIdentityCancelled()),
        ),
      ],
    );
    addTearDown(container.dispose);

    final outcome = await container
        .read(authProvider.notifier)
        .loginWithGoogle();

    expect(outcome.cancelled, isTrue);
    expect(outcome.message, isNull);
    expect(repository.receivedIdToken, isNull);
    expect(
      container.read(googleAuthStateProvider).status,
      GoogleAuthStatus.cancelled,
    );
  });

  test('account collision exposes the safe Arabic linking guidance', () async {
    final container = ProviderContainer(
      overrides: [
        authRepositoryProvider.overrideWithValue(
          _FakeAuthRepository(
            googleError: const Conflict(code: 'GOOGLE_ACCOUNT_LINK_REQUIRED'),
          ),
        ),
        googleSignInGatewayProvider.overrideWithValue(
          _FakeGoogleGateway(const GoogleIdentityToken('token')),
        ),
      ],
    );
    addTearDown(container.dispose);

    final outcome = await container
        .read(authProvider.notifier)
        .loginWithGoogle();

    expect(outcome.succeeded, isFalse);
    expect(outcome.message, contains('سجّل الدخول بالطريقة الحالية أولًا'));
    expect(
      container.read(googleAuthStateProvider).errorCode,
      'GOOGLE_ACCOUNT_LINK_REQUIRED',
    );
  });
  test('logout clears backend, Google, and local auth state', () async {
    final repository = _FakeAuthRepository();
    final gateway = _FakeGoogleGateway(const GoogleIdentityCancelled());
    final socket = _FakeChallengeSocketService();
    final container = ProviderContainer(
      overrides: [
        authRepositoryProvider.overrideWithValue(repository),
        googleSignInGatewayProvider.overrideWithValue(gateway),
        challengeSocketServiceProvider.overrideWithValue(socket),
      ],
    );
    addTearDown(container.dispose);
    container.read(authProvider);

    await container.read(authProvider.notifier).logout();

    expect(socket.disconnected, isTrue);
    expect(repository.didLogout, isTrue);
    expect(gateway.didSignOut, isTrue);
    expect(container.read(authProvider), isNull);
    expect(
      container.read(authSessionStatusProvider),
      AuthSessionStatus.unauthenticated,
    );
  });
}

const _student = StudentModel(
  id: 'user-1',
  name: 'Google Student',
  username: 'google.student',
  phone: '',
  email: 'student@example.com',
  schoolName: '',
  level: 1,
  points: 0,
  rank: 0,
  streakDays: 0,
  completedQuestions: 0,
  overallAccuracy: 0,
  selectedCompanionType: CompanionType.male,
  motionLevel: MotionLevel.full,
);

final class _FakeGoogleGateway implements GoogleSignInGateway {
  final GoogleIdentityResult result;
  bool didSignOut = false;
  _FakeGoogleGateway(this.result);

  @override
  Future<GoogleIdentityResult> signIn() async => result;

  @override
  Future<void> signOut() async => didSignOut = true;
}

final class _FakeAuthRepository extends Fake implements AuthRepository {
  final GoogleAuthSession? googleSession;
  final ApiException? googleError;
  String? receivedIdToken;
  bool didLogout = false;

  _FakeAuthRepository({this.googleSession, this.googleError});

  @override
  Future<StudentModel?> getLoggedInStudent() async => null;

  @override
  Future<GoogleAuthSession> loginWithGoogle(String idToken) async {
    receivedIdToken = idToken;
    if (googleError != null) throw googleError!;
    return googleSession!;
  }

  @override
  Future<void> logout() async => didLogout = true;
}

final class _FakeChallengeSocketService extends Fake
    implements ChallengeSocketService {
  bool disconnected = false;

  @override
  void disconnect() => disconnected = true;
}
