import 'dart:async';

import 'package:app_app/app/theme/app_theme.dart';
import 'package:app_app/core/models/student_model.dart';
import 'package:app_app/core/repositories/interfaces.dart';
import 'package:app_app/core/repositories/providers.dart';
import 'package:app_app/features/auth/presentation/login_screen.dart';
import 'package:app_app/features/auth/services/google_sign_in_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

void main() {
  testWidgets(
    'renders one Google action with the existing password form in RTL',
    (tester) async {
      tester.view.physicalSize = const Size(320, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await _pumpLogin(
        tester,
        repository: _WidgetAuthRepository(),
        gateway: _WidgetGoogleGateway(const GoogleIdentityCancelled()),
      );

      expect(find.byKey(const Key('google-sign-in-button')), findsOneWidget);
      expect(find.text('المتابعة باستخدام Google'), findsOneWidget);
      expect(find.text('البريد الإلكتروني'), findsOneWidget);
      expect(find.text('كلمة المرور'), findsOneWidget);
      expect(
        Directionality.of(
          tester.element(find.byKey(const Key('google-sign-in-button'))),
        ),
        TextDirection.rtl,
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('shows loading and treats Google cancellation silently', (
    tester,
  ) async {
    final pending = Completer<GoogleIdentityResult>();
    await _pumpLogin(
      tester,
      repository: _WidgetAuthRepository(),
      gateway: _PendingGoogleGateway(pending.future),
    );

    await tester.ensureVisible(find.byKey(const Key('google-sign-in-button')));
    await tester.tap(find.byKey(const Key('google-sign-in-button')));
    await tester.pump();
    expect(
      find.descendant(
        of: find.byKey(const Key('google-sign-in-button')),
        matching: find.byType(CircularProgressIndicator),
      ),
      findsOneWidget,
    );

    pending.complete(const GoogleIdentityCancelled());
    await tester.pump();
    await tester.pump();

    expect(find.text('login-page'), findsNothing);
    expect(find.byType(SnackBar), findsNothing);
    expect(find.text('المتابعة باستخدام Google'), findsOneWidget);
  });

  testWidgets('routes a Google user with incomplete profile to complete-profile', (tester) async {
    await _pumpLogin(
      tester,
      repository: _WidgetAuthRepository(student: _incompleteStudent),
      gateway: _WidgetGoogleGateway(const GoogleIdentityToken('token')),
    );

    await tester.ensureVisible(find.byKey(const Key('google-sign-in-button')));
    await tester.tap(find.byKey(const Key('google-sign-in-button')));
    await tester.pump();
    await tester.pump();

    expect(find.text('complete-profile-page'), findsOneWidget);
  });

  testWidgets('routes a returning Google user with complete profile to home', (tester) async {
    await _pumpLogin(
      tester,
      repository: _WidgetAuthRepository(student: _completeStudent),
      gateway: _WidgetGoogleGateway(const GoogleIdentityToken('token')),
    );

    await tester.ensureVisible(find.byKey(const Key('google-sign-in-button')));
    await tester.tap(find.byKey(const Key('google-sign-in-button')));
    await tester.pump();
    await tester.pump();

    expect(find.text('home-page'), findsOneWidget);
  });
}

Future<void> _pumpLogin(
  WidgetTester tester, {
  required AuthRepository repository,
  required GoogleSignInGateway gateway,
}) async {
  final router = GoRouter(
    initialLocation: '/login',
    routes: [
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/home', builder: (_, _) => const Text('home-page')),
      GoRoute(
        path: '/complete-profile',
        builder: (_, _) => const Text('complete-profile-page'),
      ),
      GoRoute(
        path: '/onboarding',
        builder: (_, _) => const Text('onboarding-page'),
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(repository),
        googleSignInGatewayProvider.overrideWithValue(gateway),
      ],
      child: MaterialApp.router(
        theme: AppTheme.lightTheme,
        routerConfig: router,
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('ar')],
        locale: const Locale('ar'),
      ),
    ),
  );
  await tester.pump(const Duration(seconds: 1));
}

const _incompleteStudent = StudentModel(
  id: 'user-1',
  name: 'Google Student',
  username: 'google.student',
  phone: '',
  email: 'student@example.com',
  schoolName: '',
  governorate: null,
  gradeLevel: 'THIRD_SECONDARY',
  onboardingCompleted: false,
  level: 1,
  points: 0,
  rank: 0,
  streakDays: 0,
  completedQuestions: 0,
  overallAccuracy: 0,
);

const _completeStudent = StudentModel(
  id: 'user-1',
  name: 'Google Student',
  username: 'google.student',
  phone: '777123456',
  email: 'student@example.com',
  schoolName: 'ثانوية الكويت',
  governorate: 'أمانة العاصمة',
  gradeLevel: 'THIRD_SECONDARY',
  onboardingCompleted: true,
  level: 1,
  points: 0,
  rank: 0,
  streakDays: 0,
  completedQuestions: 0,
  overallAccuracy: 0,
);

final class _WidgetAuthRepository extends Fake implements AuthRepository {
  final StudentModel student;
  final bool isNewUser;
  _WidgetAuthRepository({this.student = _incompleteStudent, this.isNewUser = false});

  @override
  Future<StudentModel?> getLoggedInStudent() async => null;

  @override
  Future<GoogleAuthSession> loginWithGoogle(String idToken) async {
    return GoogleAuthSession(user: student, isNewUser: isNewUser);
  }
}

final class _WidgetGoogleGateway implements GoogleSignInGateway {
  final GoogleIdentityResult result;
  _WidgetGoogleGateway(this.result);

  @override
  Future<GoogleIdentityResult> signIn() async => result;

  @override
  Future<void> signOut() async {}
}

final class _PendingGoogleGateway implements GoogleSignInGateway {
  final Future<GoogleIdentityResult> result;
  _PendingGoogleGateway(this.result);

  @override
  Future<GoogleIdentityResult> signIn() => result;

  @override
  Future<void> signOut() async {}
}
