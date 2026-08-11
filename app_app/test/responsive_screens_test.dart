import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:app_app/features/splash/presentation/splash_screen.dart';
import 'package:app_app/features/home/presentation/home_screen.dart';
import 'package:app_app/features/subjects/presentation/subjects_screen.dart';
import 'package:app_app/features/units/presentation/unit_details_screen.dart';
import 'package:app_app/features/lessons/presentation/lesson_details_screen.dart';
import 'package:app_app/features/exam_models/presentation/exam_models_screen.dart';
import 'package:app_app/features/challenges/presentation/challenges_screen.dart';
import 'package:app_app/features/profile/presentation/profile_screen.dart';

void main() {
  final widths = [320.0, 360.0, 390.0, 412.0];

  group('Responsive Screens & Character Display QA Tests', () {
    for (final width in widths) {
      testWidgets('SplashScreen renders safely on $width px', (tester) async {
        tester.view.physicalSize = Size(width, 700);
        tester.view.devicePixelRatio = 1.0;
        await tester.pumpWidget(
          MaterialApp.router(
            routerConfig: GoRouter(
              routes: [
                GoRoute(
                  path: '/',
                  builder: (context, state) => const SplashScreen(),
                ),
                GoRoute(
                  path: '/onboarding',
                  builder: (context, state) =>
                      const Scaffold(body: Text('Onboarding')),
                ),
                GoRoute(
                  path: '/home',
                  builder: (context, state) =>
                      const Scaffold(body: Text('Home')),
                ),
              ],
            ),
          ),
        );
        await tester.pump(const Duration(milliseconds: 3000));
        expect(tester.takeException(), isNull);
        tester.view.resetPhysicalSize();
      });

      testWidgets('HomeScreen renders safely on $width px', (tester) async {
        tester.view.physicalSize = Size(width, 700);
        tester.view.devicePixelRatio = 1.0;
        await tester.pumpWidget(
          const ProviderScope(
            child: MaterialApp(home: Scaffold(body: HomeScreen())),
          ),
        );
        await tester.pump(const Duration(milliseconds: 500));
        expect(tester.takeException(), isNull);
        tester.view.resetPhysicalSize();
      });

      testWidgets('SubjectsScreen renders safely on $width px', (tester) async {
        tester.view.physicalSize = Size(width, 700);
        tester.view.devicePixelRatio = 1.0;
        await tester.pumpWidget(
          const ProviderScope(
            child: MaterialApp(home: Scaffold(body: SubjectsScreen())),
          ),
        );
        await tester.pump(const Duration(milliseconds: 500));
        expect(tester.takeException(), isNull);
        tester.view.resetPhysicalSize();
      });

      testWidgets('UnitDetailsScreen renders safely on $width px', (
        tester,
      ) async {
        tester.view.physicalSize = Size(width, 700);
        tester.view.devicePixelRatio = 1.0;
        await tester.pumpWidget(
          const ProviderScope(
            child: MaterialApp(
              home: UnitDetailsScreen(unitId: 'unit_motion_1'),
            ),
          ),
        );
        await tester.pump(const Duration(milliseconds: 500));
        expect(tester.takeException(), isNull);
        tester.view.resetPhysicalSize();
      });

      testWidgets('LessonDetailsScreen renders safely on $width px', (
        tester,
      ) async {
        tester.view.physicalSize = Size(width, 700);
        tester.view.devicePixelRatio = 1.0;
        await tester.pumpWidget(
          const ProviderScope(
            child: MaterialApp(
              home: LessonDetailsScreen(lessonId: 'les_momentum'),
            ),
          ),
        );
        await tester.pump(const Duration(milliseconds: 500));
        expect(tester.takeException(), isNull);
        tester.view.resetPhysicalSize();
      });

      testWidgets('ExamModelsScreen renders safely on $width px', (
        tester,
      ) async {
        tester.view.physicalSize = Size(width, 700);
        tester.view.devicePixelRatio = 1.0;
        await tester.pumpWidget(
          const ProviderScope(child: MaterialApp(home: ExamModelsScreen())),
        );
        await tester.pump(const Duration(milliseconds: 500));
        expect(tester.takeException(), isNull);
        tester.view.resetPhysicalSize();
      });

      testWidgets('ChallengesScreen renders safely on $width px', (
        tester,
      ) async {
        tester.view.physicalSize = Size(width, 700);
        tester.view.devicePixelRatio = 1.0;
        await tester.pumpWidget(
          const ProviderScope(
            child: MaterialApp(home: Scaffold(body: ChallengesScreen())),
          ),
        );
        await tester.pump(const Duration(milliseconds: 500));
        expect(tester.takeException(), isNull);
        tester.view.resetPhysicalSize();
      });

      testWidgets('ProfileScreen renders safely on $width px', (tester) async {
        tester.view.physicalSize = Size(width, 700);
        tester.view.devicePixelRatio = 1.0;
        await tester.pumpWidget(
          const ProviderScope(
            child: MaterialApp(home: Scaffold(body: ProfileScreen())),
          ),
        );
        await tester.pump(const Duration(milliseconds: 500));
        expect(tester.takeException(), isNull);
        tester.view.resetPhysicalSize();
      });
    }
  });
}
