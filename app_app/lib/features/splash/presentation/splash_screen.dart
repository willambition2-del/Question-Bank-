import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../app/theme/design_tokens.dart';
import '../../auth/providers/auth_provider.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  Timer? _minimumTimer;
  ProviderSubscription<AuthSessionStatus>? _statusSubscription;
  bool _minimumElapsed = false;
  bool _navigationStarted = false;

  @override
  void initState() {
    super.initState();
    _minimumTimer = Timer(const Duration(milliseconds: 1200), () {
      _minimumElapsed = true;
      _tryNavigate();
    });
    try {
      _statusSubscription = ref.listenManual<AuthSessionStatus>(
        authSessionStatusProvider,
        (_, __) => _tryNavigate(),
        fireImmediately: true,
      );
    } on StateError {
      // Isolated widget tests may render Splash without a ProviderScope.
    }
  }

  Future<void> _tryNavigate() async {
    if (!_minimumElapsed || _navigationStarted || !mounted) return;
    AuthSessionStatus status;
    try {
      status = ref.read(authSessionStatusProvider);
    } on StateError {
      return;
    }
    if (status == AuthSessionStatus.initial ||
        status == AuthSessionStatus.restoring) {
      return;
    }
    _navigationStarted = true;
    if (status == AuthSessionStatus.authenticated) {
      final user = ref.read(authProvider);
      if (user != null && !user.onboardingCompleted) {
        context.go('/complete-profile');
      } else {
        context.go('/home');
      }
      return;
    }
    final preferences = await SharedPreferences.getInstance();
    if (!mounted) return;
    context.go(
      preferences.getBool('onboardingCompleted') == true
          ? '/login'
          : '/onboarding',
    );
  }

  @override
  void dispose() {
    _minimumTimer?.cancel();
    _statusSubscription?.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Application Name & Title
            Text(
              "بنك الأسئلة",
              style: AppTypography.displayLarge.copyWith(
                color: AppColors.primaryBlue,
                fontSize: 38,
                fontWeight: FontWeight.w900,
              ),
            ).animate().fadeIn(duration: 800.ms).slideY(begin: 0.3, end: 0),

            const SizedBox(height: AppSpacing.xxs),

            Text(
              "طريقك نحو التفوق والنجاح الدراسي",
              style: AppTypography.sectionTitle.copyWith(
                color: AppColors.secondaryText,
                fontWeight: FontWeight.w600,
              ),
            ).animate().fadeIn(delay: 400.ms, duration: 800.ms),

            const SizedBox(height: AppSpacing.xxl * 1.5),

            // Hero Icon
            const Icon(
              Icons.school_rounded,
              size: 120,
              color: AppColors.primaryBlue,
            ).animate().scale(delay: 600.ms, duration: 600.ms),

            const SizedBox(height: AppSpacing.xxl),

            // Subtitle
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.xs,
              ),
              decoration: BoxDecoration(
                color: AppColors.lightBlue,
                borderRadius: BorderRadius.circular(AppRadius.pill),
              ),
              child: Text(
                "أهلاً بك يا بطل! 👋",
                style: AppTypography.cardTitle.copyWith(
                  color: AppColors.primaryBlue,
                ),
              ),
            ).animate().fadeIn(delay: 1200.ms).slideY(begin: 0.5, end: 0),
          ],
        ),
      ),
    );
  }
}
