import 'package:google_sign_in/google_sign_in.dart';

const googleServerClientId = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');

sealed class GoogleIdentityResult {
  const GoogleIdentityResult();
}

final class GoogleIdentityToken extends GoogleIdentityResult {
  final String idToken;
  const GoogleIdentityToken(this.idToken);
}

final class GoogleIdentityCancelled extends GoogleIdentityResult {
  const GoogleIdentityCancelled();
}

final class GoogleIdentityFailure extends GoogleIdentityResult {
  final String code;
  final String message;
  const GoogleIdentityFailure(this.code, this.message);
}

abstract interface class GoogleSignInGateway {
  Future<GoogleIdentityResult> signIn();
  Future<void> signOut();
}

abstract interface class GoogleIdentityClient {
  Future<void> initialize({required String serverClientId});
  Future<String?> authenticateIdToken();
  Future<void> signOut();
}

final class PluginGoogleIdentityClient implements GoogleIdentityClient {
  final GoogleSignIn _google;

  PluginGoogleIdentityClient([GoogleSignIn? google])
    : _google = google ?? GoogleSignIn.instance;

  @override
  Future<void> initialize({required String serverClientId}) {
    return _google.initialize(serverClientId: serverClientId);
  }

  @override
  Future<String?> authenticateIdToken() async {
    if (!_google.supportsAuthenticate()) {
      throw const GoogleSignInException(
        code: GoogleSignInExceptionCode.unknownError,
        description: 'Google authentication is unsupported on this platform',
      );
    }
    final account = await _google.authenticate();
    return account.authentication.idToken;
  }

  @override
  Future<void> signOut() => _google.signOut();
}

final class GoogleSignInService implements GoogleSignInGateway {
  final GoogleIdentityClient _client;
  final String _serverClientId;
  Future<void>? _initialization;

  GoogleSignInService({
    required GoogleIdentityClient client,
    String serverClientId = googleServerClientId,
  }) : _client = client,
       _serverClientId = serverClientId.trim();

  @override
  Future<GoogleIdentityResult> signIn() async {
    if (_serverClientId.isEmpty) {
      return const GoogleIdentityFailure(
        'GOOGLE_CONFIGURATION_MISSING',
        'تسجيل Google غير مهيأ على هذا الإصدار.',
      );
    }
    try {
      await (_initialization ??= _client.initialize(
        serverClientId: _serverClientId,
      ));
      final token = await _client.authenticateIdToken();
      if (token == null || token.trim().isEmpty) {
        return const GoogleIdentityFailure(
          'GOOGLE_ID_TOKEN_MISSING',
          'تعذر الحصول على رمز Google الآمن. حاول مرة أخرى.',
        );
      }
      return GoogleIdentityToken(token);
    } on GoogleSignInException catch (error) {
      if (error.code == GoogleSignInExceptionCode.canceled) {
        return const GoogleIdentityCancelled();
      }
      return const GoogleIdentityFailure(
        'GOOGLE_SIGN_IN_FAILED',
        'تعذر تسجيل الدخول باستخدام Google. حاول مرة أخرى.',
      );
    } catch (_) {
      return const GoogleIdentityFailure(
        'GOOGLE_SIGN_IN_FAILED',
        'تعذر تسجيل الدخول باستخدام Google. حاول مرة أخرى.',
      );
    }
  }

  @override
  Future<void> signOut() async {
    try {
      await _client.signOut();
    } catch (_) {
      // Backend and secure-storage logout must never be blocked by Google SDK.
    }
  }
}
