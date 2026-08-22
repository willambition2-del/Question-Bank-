import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../theme/design_tokens.dart';
import '../../features/splash/presentation/splash_screen.dart';
import '../../features/onboarding/presentation/onboarding_screen.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/home/presentation/main_shell_screen.dart';
import '../../features/subjects/presentation/subject_details_screen.dart';
import '../../features/units/presentation/unit_details_screen.dart';
import '../../features/lessons/presentation/lesson_details_screen.dart';
import '../../features/exam_models/presentation/exam_models_screen.dart';
import '../../features/quiz/presentation/quiz_setup_screen.dart';
import '../../features/quiz/presentation/quiz_screen.dart';
import '../../features/results/presentation/quiz_result_screen.dart';
import '../../features/challenges/presentation/challenge_waiting_screen.dart';
import '../../features/challenges/presentation/challenge_live_screen.dart';
import '../../features/challenges/presentation/challenges_screen.dart';
import '../../features/leaderboard/presentation/leaderboard_screen.dart';
import '../../features/profile/presentation/achievements_screen.dart';
import '../../features/saved_questions/presentation/saved_questions_screen.dart';
import '../../features/profile/presentation/settings_screen.dart';
import '../../features/mistakes/presentation/mistakes_screen.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/assistant/presentation/assistant_screen.dart';
import '../../features/curriculum/presentation/curriculum_subjects_screen.dart';
import '../../features/curriculum/presentation/curriculum_resources_screen.dart';

import '../../features/onboarding/presentation/complete_profile_screen.dart';
import '../../features/auth/providers/auth_provider.dart';

import 'tab_index_provider.dart';

final appRouter = GoRouter(
  initialLocation: '/splash',
  redirect: (context, state) {
    final loc = state.matchedLocation;
    if (loc == '/splash') return null;

    try {
      final container = ProviderScope.containerOf(context, listen: false);
      final status = container.read(authSessionStatusProvider);
      if (status == AuthSessionStatus.initial ||
          status == AuthSessionStatus.restoring) {
        return null;
      }

      final user = container.read(authProvider);
      final isAuthenticated =
          status == AuthSessionStatus.authenticated && user != null;

      final isAuthRoute =
          loc == '/login' || loc == '/register' || loc == '/onboarding';
      final isCompleteProfileRoute = loc == '/complete-profile';

      if (!isAuthenticated) {
        if (!isAuthRoute) {
          return '/login';
        }
        return null;
      }

      // Authenticated but profile is incomplete
      if (!user.onboardingCompleted) {
        if (!isCompleteProfileRoute) {
          return '/complete-profile';
        }
        return null;
      }

      // Authenticated with complete profile
      if (isAuthRoute || isCompleteProfileRoute) {
        return '/home';
      }
    } catch (_) {
      // Container not available in isolated test environments
    }

    return null;
  },
  routes: [
    // Splash Route
    GoRoute(path: '/splash', builder: (context, state) => const SplashScreen()),
    // Onboarding Route
    GoRoute(
      path: '/onboarding',
      builder: (context, state) => const OnboardingScreen(),
    ),
    // Complete Profile / Mandatory Onboarding Route
    GoRoute(
      path: '/complete-profile',
      builder: (context, state) => const CompleteProfileScreen(),
    ),
    // Auth Routes
    GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
    GoRoute(
      path: '/register',
      builder: (context, state) => const RegisterScreen(),
    ),
    GoRoute(
      path: '/home',
      builder: (context, state) => const MainShellScreen(),
    ),

    GoRoute(
      path: '/assistant',
      builder: (context, state) => AssistantScreen(
        lessonId: state.uri.queryParameters['lessonId'],
        questionId: state.uri.queryParameters['questionId'],
        attemptId: state.uri.queryParameters['attemptId'],
        initialAction: state.uri.queryParameters['action'],
      ),
    ),

    // Tab redirects to Home Shell index
    GoRoute(
      path: '/subjects',
      redirect: (context, state) {
        ProviderScope.containerOf(
          context,
          listen: false,
        ).read(tabIndexProvider.notifier).setIndex(1);
        return '/home';
      },
    ),
    GoRoute(
      path: '/challenges',
      builder: (context, state) => const ChallengesScreen(),
    ),
    GoRoute(
      path: '/statistics',
      redirect: (context, state) {
        ProviderScope.containerOf(
          context,
          listen: false,
        ).read(tabIndexProvider.notifier).setIndex(3);
        return '/home';
      },
    ),
    GoRoute(
      path: '/profile',
      redirect: (context, state) {
        ProviderScope.containerOf(
          context,
          listen: false,
        ).read(tabIndexProvider.notifier).setIndex(4);
        return '/home';
      },
    ),

    // Curriculum Routes
    GoRoute(
      path: '/curriculum-resources',
      builder: (context, state) => const CurriculumSubjectsScreen(),
    ),
    GoRoute(
      path: '/curriculum-resources/:subjectId',
      builder: (context, state) {
        final subjectId = state.pathParameters['subjectId'] ?? '';
        return CurriculumResourcesScreen(
          subjectId: subjectId,
          subject: state.extra as dynamic,
        );
      },
    ),

    // Subject Details RESTful Route
    GoRoute(
      path: '/subjects/:subjectId',
      builder: (context, state) {
        final subjectId = state.pathParameters['subjectId'] ?? '';
        return SubjectDetailsScreen(subjectId: subjectId);
      },
    ),
    // Unit Details RESTful Route
    GoRoute(
      path: '/subjects/:subjectId/units/:unitId',
      builder: (context, state) {
        final unitId = state.pathParameters['unitId'] ?? '';
        return UnitDetailsScreen(unitId: unitId);
      },
    ),
    // Lesson Details RESTful Route
    GoRoute(
      path: '/subjects/:subjectId/units/:unitId/lessons/:lessonId',
      builder: (context, state) {
        final lessonId = state.pathParameters['lessonId'] ?? '';
        return LessonDetailsScreen(lessonId: lessonId);
      },
    ),

    // Backward compatibility redirects for old routes
    GoRoute(
      path: '/subject-details',
      redirect: (context, state) {
        final subjectId = state.uri.queryParameters['subjectId'] ?? '';
        return '/subjects/$subjectId';
      },
    ),
    GoRoute(
      path: '/unit-details',
      redirect: (context, state) {
        final unitId = state.uri.queryParameters['unitId'] ?? '';
        return '/subjects/any/units/$unitId';
      },
    ),
    GoRoute(
      path: '/lesson-details',
      redirect: (context, state) {
        final lessonId = state.uri.queryParameters['lessonId'] ?? '';
        return '/subjects/any/units/any/lessons/$lessonId';
      },
    ),

    // Exam Models
    GoRoute(
      path: '/exam-models',
      builder: (context, state) => const ExamModelsScreen(),
    ),

    // Quiz Setup RESTful Path
    GoRoute(
      path: '/quiz/setup',
      builder: (context, state) {
        final subjectId = state.uri.queryParameters['subjectId'];
        final unitId = state.uri.queryParameters['unitId'];
        final lessonId = state.uri.queryParameters['lessonId'];
        final examModelId = state.uri.queryParameters['examModelId'];
        final scope = state.uri.queryParameters['scope'];
        return QuizSetupScreen(
          subjectId: subjectId,
          unitId: unitId,
          lessonId: lessonId,
          examModelId: examModelId,
          scope: scope,
        );
      },
    ),
    GoRoute(
      path: '/quiz-setup',
      redirect: (context, state) {
        final queryStr = state.uri.query;
        return '/quiz/setup${queryStr.isNotEmpty ? '?$queryStr' : ''}';
      },
    ),

    // Quiz Play
    GoRoute(
      path: '/quiz/play',
      builder: (context, state) => const QuizScreen(),
    ),
    GoRoute(path: '/quiz', redirect: (context, state) => '/quiz/play'),

    // Quiz Result
    GoRoute(
      path: '/quiz/result',
      builder: (context, state) => const QuizResultScreen(),
    ),
    GoRoute(path: '/quiz-result', redirect: (context, state) => '/quiz/result'),

    // Challenges Waiting Lobby
    GoRoute(
      path: '/challenges/waiting',
      builder: (context, state) {
        final mode = state.uri.queryParameters['mode'] ?? 'oneVsOne';
        final subjectId = state.uri.queryParameters['subjectId'];
        return ChallengeWaitingScreen(mode: mode, subjectId: subjectId);
      },
    ),
    // Challenge Live Arena
    GoRoute(
      path: '/challenges/live',
      builder: (context, state) => const ChallengeLiveScreen(),
    ),
    // Leaderboard List
    GoRoute(
      path: '/leaderboard',
      builder: (context, state) => const LeaderboardScreen(),
    ),
    // Achievements List
    GoRoute(
      path: '/achievements',
      builder: (context, state) => const AchievementsScreen(),
    ),

    // Saved Questions RESTful Path
    GoRoute(
      path: '/saved',
      builder: (context, state) => const SavedQuestionsScreen(),
    ),
    GoRoute(path: '/saved-questions', redirect: (context, state) => '/saved'),

    GoRoute(
      path: '/notifications',
      builder: (context, state) => const NotificationsScreen(),
    ),
    // Settings Screen
    GoRoute(
      path: '/settings',
      builder: (context, state) => const SettingsScreen(),
    ),
    // Mistakes Log List
    GoRoute(
      path: '/mistakes',
      builder: (context, state) => const MistakesScreen(),
    ),
  ],

  // Comprehensive Error Page for invalid routes
  errorBuilder: (context, state) => Scaffold(
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.error_outline,
              size: 80,
              color: AppColors.errorCoral,
            ),
            const SizedBox(height: 24),
            Text(
              'عذراً، الصفحة غير موجودة',
              style: AppTypography.pageTitle.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'الرابط الذي تحاول الوصول إليه غير صحيح أو تم نقله.',
              style: AppTypography.body,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => context.go('/home'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryBlue,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 12,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'العودة للرئيسية',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      ),
    ),
  ),
);
