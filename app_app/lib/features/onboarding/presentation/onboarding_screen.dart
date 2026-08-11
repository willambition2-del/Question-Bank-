import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/widgets/app_button.dart';
import '../../auth/providers/auth_provider.dart';

class OnboardingScreen extends ConsumerWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final student = ref.watch(authProvider);

    final titleStr = "بنك الأسئلة\nللثالث الثانوي";
    final subtitleStr = "تعلم بذكاء.. وتفوق بثقة";

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.md,
            ),
            child: Column(
              children: [
                const SizedBox(height: AppSpacing.sm),

                const SizedBox(height: AppSpacing.xl),

                // --- HEADER TITLE & SUBTITLE ---
                Text(
                  titleStr,
                  style: AppTypography.displayLarge.copyWith(
                    color: AppColors.darkText,
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    height: 1.2,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  subtitleStr,
                  style: AppTypography.cardTitle.copyWith(
                    color: AppColors.primaryBlue,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.md),

                // --- FULL BODY ILLUSTRATION ---
                Expanded(
                  child: Center(
                    child: Icon(
                      Icons.school_rounded,
                      size: 120,
                      color: AppColors.primaryBlue.withValues(alpha: 0.2),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),

                // --- BOTTOM BUTTONS ---
                PrimaryButton(
                  width: double.infinity,
                  text: "ابدأ رحلتك الآن",
                  onPressed: () async {
                    final preferences = await SharedPreferences.getInstance();
                    await preferences.setBool('onboardingCompleted', true);
                    if (context.mounted) {
                      context.go(student == null ? '/register' : '/home');
                    }
                  },
                ),
                const SizedBox(height: AppSpacing.sm),
                OutlineButton(
                  width: double.infinity,
                  text: "سجل دخولك",
                  onPressed: () async {
                    final preferences = await SharedPreferences.getInstance();
                    await preferences.setBool('onboardingCompleted', true);
                    if (context.mounted) context.go('/login');
                  },
                ),
                const SizedBox(height: AppSpacing.md),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
