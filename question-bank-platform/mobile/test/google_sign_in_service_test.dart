import 'package:app_app/features/auth/services/google_sign_in_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_sign_in/google_sign_in.dart';

void main() {
  group('GoogleSignInService', () {
    test('returns a verified ID token and initializes once', () async {
      final client = _FakeGoogleIdentityClient(token: 'google-id-token');
      final service = GoogleSignInService(
        client: client,
        serverClientId: 'web-client-id',
      );

      final first = await service.signIn();
      final second = await service.signIn();

      expect((first as GoogleIdentityToken).idToken, 'google-id-token');
      expect(second, isA<GoogleIdentityToken>());
      expect(client.initializeCalls, 1);
      expect(client.serverClientId, 'web-client-id');
    });

    test('treats user cancellation as a silent result', () async {
      final service = GoogleSignInService(
        client: _FakeGoogleIdentityClient(
          error: const GoogleSignInException(
            code: GoogleSignInExceptionCode.canceled,
          ),
        ),
        serverClientId: 'web-client-id',
      );

      expect(await service.signIn(), isA<GoogleIdentityCancelled>());
    });

    test('rejects missing ID token', () async {
      final service = GoogleSignInService(
        client: _FakeGoogleIdentityClient(token: null),
        serverClientId: 'web-client-id',
      );

      final result = await service.signIn() as GoogleIdentityFailure;
      expect(result.code, 'GOOGLE_ID_TOKEN_MISSING');
    });

    test('fails safely when server client ID is not configured', () async {
      final client = _FakeGoogleIdentityClient(token: 'unused');
      final result = await GoogleSignInService(
        client: client,
        serverClientId: ' ',
      ).signIn();

      expect(
        (result as GoogleIdentityFailure).code,
        'GOOGLE_CONFIGURATION_MISSING',
      );
      expect(client.initializeCalls, 0);
    });

    test('Google sign-out failure never blocks logout', () async {
      final client = _FakeGoogleIdentityClient(
        token: 'unused',
        signOutError: StateError('offline'),
      );

      await GoogleSignInService(
        client: client,
        serverClientId: 'web-client-id',
      ).signOut();

      expect(client.signOutCalls, 1);
    });
  });
}

final class _FakeGoogleIdentityClient implements GoogleIdentityClient {
  final String? token;
  final Object? error;
  final Object? signOutError;
  int initializeCalls = 0;
  int signOutCalls = 0;
  String? serverClientId;

  _FakeGoogleIdentityClient({this.token, this.error, this.signOutError});

  @override
  Future<String?> authenticateIdToken() async {
    if (error != null) throw error!;
    return token;
  }

  @override
  Future<void> initialize({required String serverClientId}) async {
    initializeCalls++;
    this.serverClientId = serverClientId;
  }

  @override
  Future<void> signOut() async {
    signOutCalls++;
    if (signOutError != null) throw signOutError!;
  }
}
