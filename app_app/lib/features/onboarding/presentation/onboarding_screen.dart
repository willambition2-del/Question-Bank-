import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/models/companion_enums.dart';
import '../../../core/utils/companion_context_resolver.dart';
import '../../../core/widgets/animated_companion.dart';
import '../../../core/widgets/app_button.dart';
import '../../auth/providers/auth_provider.dart';

class OnboardingScreen extends ConsumerWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final student = ref.watch(authProvider);
    final companion = student?.selectedCompanionType ?? CompanionType.male;
    final isMale = companion == CompanionType.male;

    final titleStr = isMale
        ? "بنك الأسئلة\nللثالث الثانوي"
        : "بنك الأسئلة\nلطلاب الثانوية";
    final subtitleStr = isMale
        ? "تعلم بذكاء.. وتفوق بثقة"
        : "تعلم بذكاء.. وحقق نجاحك";

    final welcomeContext = CompanionContextResolver.resolveWelcome(
      isMale: isMale,
    );

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

                // --- GENDER / MODE TOGGLE SWITCH AT TOP ---
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.lightBlue,
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            isMale ? Icons.face : Icons.face_retouching_natural,
                            color: AppColors.primaryBlue,
                            size: 16,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            isMale ? "وضع الطالب 👦" : "وضع الطالبة 👧",
                            style: AppTypography.caption.copyWith(
                              color: AppColors.primaryBlue,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        ref
                            .read(authProvider.notifier)
                            .updateCompanionType(
                              isMale
                                  ? CompanionType.female
                                  : CompanionType.male,
                            );
                      },
                      child: Text(
                        isMale ? "تبديل إلى طالبة 👧" : "تبديل إلى طالب 👦",
                        style: AppTypography.caption.copyWith(
                          color: AppColors.primaryBlue,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),

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
                    color: isMale
                        ? AppColors.primaryBlue
                        : AppColors.secondaryTeal,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.md),

                // --- FULL BODY 3D CHARACTER ILLUSTRATION VIA ANIMATED COMPANION ---
                Expanded(
                  child: Center(
                    child: AnimatedCompanion(
                      companionType: companion,
                      emotion: welcomeContext.emotion,
                      message: welcomeContext.message,
                      size: CharacterSize.large,
                      showBubble: true,
                      blendWhiteBackground: false,
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
