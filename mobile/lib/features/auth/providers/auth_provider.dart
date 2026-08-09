import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/student_model.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/models/companion_enums.dart';
import '../../../core/repositories/providers.dart';
import '../services/google_sign_in_service.dart';

enum AuthSessionStatus {
  initial,
  restoring,
  authenticated,
  unauthenticated,
  failure,
}

class AuthSessionStatusNotifier extends Notifier<AuthSessionStatus> {
  @override
  AuthSessionStatus build() => AuthSessionStatus.initial;

  void setStatus(AuthSessionStatus value) => state = value;
}

final authSessionStatusProvider =
    NotifierProvider<AuthSessionStatusNotifier, AuthSessionStatus>(
      AuthSessionStatusNotifier.new,
    );

enum GoogleAuthStatus { idle, loading, cancelled, success, failure }

class GoogleAuthState {
  final GoogleAuthStatus status;
  final String? errorCode;
  final String? message;
  final bool isNewUser;

  const GoogleAuthState({
    this.status = GoogleAuthStatus.idle,
    this.errorCode,
    this.message,
    this.isNewUser = false,
  });
}

class GoogleAuthStateNotifier extends Notifier<GoogleAuthState> {
  @override
  GoogleAuthState build() => const GoogleAuthState();

  void setState(GoogleAuthState value) => state = value;
  void reset() => state = const GoogleAuthState();
}

final googleAuthStateProvider =
    NotifierProvider<GoogleAuthStateNotifier, GoogleAuthState>(
      GoogleAuthStateNotifier.new,
    );

class GoogleLoginOutcome {
  final bool succeeded;
  final bool cancelled;
  final bool isNewUser;
  final String? message;

  const GoogleLoginOutcome({
    required this.succeeded,
    this.cancelled = false,
    this.isNewUser = false,
    this.message,
  });
}

class AuthNotifier extends Notifier<StudentModel?> {
  @override
  StudentModel? build() {
    // Initial fetch of logged in student (simulating local session check)
    Future.microtask(_loadSession);
    return null;
  }

  Future<void> _loadSession() async {
    ref
        .read(authSessionStatusProvider.notifier)
        .setStatus(AuthSessionStatus.restoring);
    try {
      final user = await ref.read(authRepositoryProvider).getLoggedInStudent();
      state = user;
      ref
          .read(authSessionStatusProvider.notifier)
          .setStatus(
            user == null
                ? AuthSessionStatus.unauthenticated
                : AuthSessionStatus.authenticated,
          );
    } catch (_) {
      state = null;
      ref
          .read(authSessionStatusProvider.notifier)
          .setStatus(AuthSessionStatus.failure);
    }
  }

  Future<bool> login(String username, String password) async {
    try {
      final user = await ref
          .read(authRepositoryProvider)
          .login(username, password);
      if (user != null) {
        state = user;
        ref
            .read(authSessionStatusProvider.notifier)
            .setStatus(AuthSessionStatus.authenticated);
        return true;
      }
    } catch (_) {
      ref
          .read(authSessionStatusProvider.notifier)
          .setStatus(AuthSessionStatus.failure);
    }
    return false;
  }

  Future<GoogleLoginOutcome> loginWithGoogle() async {
    final googleState = ref.read(googleAuthStateProvider.notifier);
    googleState.setState(
      const GoogleAuthState(status: GoogleAuthStatus.loading),
    );

    final identity = await ref.read(googleSignInGatewayProvider).signIn();
    if (identity is GoogleIdentityCancelled) {
      googleState.setState(
        const GoogleAuthState(status: GoogleAuthStatus.cancelled),
      );
      return const GoogleLoginOutcome(succeeded: false, cancelled: true);
    }
    if (identity is GoogleIdentityFailure) {
      googleState.setState(
        GoogleAuthState(
          status: GoogleAuthStatus.failure,
          errorCode: identity.code,
          message: identity.message,
        ),
      );
      return GoogleLoginOutcome(succeeded: false, message: identity.message);
    }

    try {
      final session = await ref
          .read(authRepositoryProvider)
          .loginWithGoogle((identity as GoogleIdentityToken).idToken);
      state = session.user;
      ref
          .read(authSessionStatusProvider.notifier)
          .setStatus(AuthSessionStatus.authenticated);
      googleState.setState(
        GoogleAuthState(
          status: GoogleAuthStatus.success,
          isNewUser: session.isNewUser,
        ),
      );
      return GoogleLoginOutcome(succeeded: true, isNewUser: session.isNewUser);
    } on ApiException catch (error) {
      final message = _googleErrorMessage(error.backendCode);
      googleState.setState(
        GoogleAuthState(
          status: GoogleAuthStatus.failure,
          errorCode: error.backendCode,
          message: message,
        ),
      );
      return GoogleLoginOutcome(succeeded: false, message: message);
    } catch (_) {
      const message = 'تعذر تسجيل الدخول باستخدام Google. حاول مرة أخرى.';
      googleState.setState(
        const GoogleAuthState(
          status: GoogleAuthStatus.failure,
          message: message,
        ),
      );
      return const GoogleLoginOutcome(succeeded: false, message: message);
    }
  }

  String _googleErrorMessage(String? code) => switch (code) {
    'GOOGLE_ACCOUNT_LINK_REQUIRED' =>
      'يوجد حساب بهذا البريد. سجّل الدخول بالطريقة الحالية أولًا، ثم اربط حساب Google من الإعدادات.',
    'GOOGLE_EMAIL_NOT_VERIFIED' =>
      'يجب أن يكون بريد Google موثّقًا قبل إنشاء الحساب.',
    'SOCIAL_PROVIDER_DISABLED' =>
      'تسجيل الدخول باستخدام Google غير متاح حاليًا.',
    'GOOGLE_TOKEN_EXPIRED' => 'انتهت جلسة Google. حاول تسجيل الدخول مرة أخرى.',
    'GOOGLE_TOKEN_INVALID' || 'GOOGLE_TOKEN_AUDIENCE_INVALID' =>
      'تعذر التحقق من حساب Google. حاول مرة أخرى.',
    _ => 'تعذر تسجيل الدخول باستخدام Google. حاول مرة أخرى.',
  };
  Future<bool> register({
    required String name,
    required String username,
    required String phone,
    required String schoolName,
    required String password,
    required CompanionType companionType,
  }) async {
    try {
      final user = await ref
          .read(authRepositoryProvider)
          .register(
            name: name,
            username: username,
            phone: phone,
            schoolName: schoolName,
            password: password,
            companionType: companionType,
          );
      if (user != null) {
        state = user;
        ref
            .read(authSessionStatusProvider.notifier)
            .setStatus(AuthSessionStatus.authenticated);
        return true;
      }
    } catch (_) {
      ref
          .read(authSessionStatusProvider.notifier)
          .setStatus(AuthSessionStatus.failure);
    }
    return false;
  }

  Future<void> updateCompanionType(CompanionType companionType) async {
    if (state != null) {
      await ref.read(authRepositoryProvider).updateCompanion(companionType);
      state = state!.copyWith(selectedCompanionType: companionType);
    }
  }

  Future<void> updateMotionLevel(MotionLevel motionLevel) async {
    if (state != null) {
      await ref.read(authRepositoryProvider).updateMotionLevel(motionLevel);
      state = state!.copyWith(motionLevel: motionLevel);
    }
  }

  Future<void> updateSoundsEnabled(bool enabled) async {
    if (state != null) {
      state = state!.copyWith(soundsEnabled: enabled);
    }
  }

  Future<void> updateHapticsEnabled(bool enabled) async {
    if (state != null) {
      state = state!.copyWith(hapticsEnabled: enabled);
    }
  }

  Future<void> addPointsAndCompletedQuestions(
    int points,
    int count,
    double accuracy,
  ) async {
    if (state != null) {
      await ref
          .read(authRepositoryProvider)
          .updateStudentPointsAndStats(points, count, accuracy);
      state = state!.copyWith(
        points: state!.points + points,
        completedQuestions: state!.completedQuestions + count,
        overallAccuracy: accuracy > 0
            ? (state!.overallAccuracy * 0.7 + accuracy * 0.3)
            : state!.overallAccuracy,
      );
    }
  }

  Future<void> logout() async {
    ref.read(challengeSocketServiceProvider).disconnect();
    await ref.read(authRepositoryProvider).logout();
    await ref.read(googleSignInGatewayProvider).signOut();
    ref.read(googleAuthStateProvider.notifier).reset();
    state = null;
    ref
        .read(authSessionStatusProvider.notifier)
        .setStatus(AuthSessionStatus.unauthenticated);
  }
}

final authProvider = NotifierProvider<AuthNotifier, StudentModel?>(() {
  return AuthNotifier();
});
