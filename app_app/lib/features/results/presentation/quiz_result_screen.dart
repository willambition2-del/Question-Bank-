import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/models/companion_enums.dart';
import '../../../core/utils/companion_context_resolver.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/animated_companion.dart';
import '../../auth/providers/auth_provider.dart';
import '../../quiz/providers/quiz_provider.dart';

class QuizResultScreen extends ConsumerWidget {
  const QuizResultScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final apiResult = ref.watch(quizNotifierProvider).result;
    if (apiResult == null) {
      return AppScaffold(
        body: Center(
          child: Text(
            'لا توجد نتيجة متاحة لهذه المحاولة.',
            style: AppTypography.body,
          ),
        ),
      );
    }
    final score = apiResult.summary.scorePercent;
    final correctAnswers = apiResult.summary.correctCount;
    final wrongAnswers = apiResult.summary.wrongCount;
    final earnedPoints = apiResult.pointsEarned;
    final timeSpentSeconds = apiResult.durationSeconds;
    final student = ref.watch(authProvider);
    final companion = student?.selectedCompanionType ?? CompanionType.male;
    final isMale = companion == CompanionType.male;

    final resultContext = CompanionContextResolver.resolveQuizResult(
      accuracyPct: score,
      isMale: isMale,
    );

    String feedbackTitle;
    if (score >= 80) {
      feedbackTitle = isMale ? "أنت أسطورة تفوق! 🏆" : "أنتِ أسطورة تفوق! 🏆";
    } else if (score >= 50) {
      feedbackTitle = "نتيجة جيدة ومستواك في صعود! 📈";
    } else {
      feedbackTitle = "لا تقلق، الأخطاء بداية التعلم! 💪";
    }

    final minutes = timeSpentSeconds ~/ 60;
    final seconds = timeSpentSeconds % 60;
    final timeStr = "$minutes د و $seconds ث";

    return AppScaffold(
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        child: Column(
          children: [
            const SizedBox(height: AppSpacing.md),
            Text(
              "نتيجة الاختبار النهائي",
              style: AppTypography.pageTitle.copyWith(fontSize: 24),
            ),
            const SizedBox(height: AppSpacing.sm),

            // --- RESULT SUMMARY HERO CARD ---
            AppCard(
              backgroundColor: AppColors.surface,
              border: Border.all(
                color: score >= 80
                    ? AppColors.successGreen
                    : (score >= 50
                          ? AppColors.primaryBlue
                          : AppColors.errorCoral),
                width: 1.5,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          feedbackTitle,
                          style: AppTypography.cardTitle.copyWith(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          resultContext.message,
                          style: AppTypography.body.copyWith(fontSize: 12),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.lightGold,
                            borderRadius: BorderRadius.circular(AppRadius.pill),
                          ),
                          child: Text(
                            "+$earnedPoints نقطة اكتُسبت 🌟",
                            style: const TextStyle(
                              color: AppColors.warmOrange,
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  AnimatedCompanion(
                    companionType: companion,
                    emotion: resultContext.emotion,
                    customHeight: 140,
                    showBubble: false,
                    blendWhiteBackground: true,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            // --- SCORE CIRCLE & ACCURACY ---
            AppCard(
              child: Column(
                children: [
                  Text("نسبة الدقة الحالية", style: AppTypography.caption),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    "%${score.toInt()}",
                    style: AppTypography.displayLarge.copyWith(
                      color: score >= 80
                          ? AppColors.successGreen
                          : (score >= 50
                                ? AppColors.primaryBlue
                                : AppColors.errorCoral),
                      fontSize: 42,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildStatTile(
                        "الأسئلة الصحيحة",
                        "$correctAnswers",
                        AppColors.successGreen,
                      ),
                      _buildStatTile(
                        "الأسئلة الخاطئة",
                        "$wrongAnswers",
                        AppColors.errorCoral,
                      ),
                      _buildStatTile("الزمن المستغرق", timeStr, AppColors.info),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),

            // --- ACTIONS BUTTONS ---
            PrimaryButton(
              width: double.infinity,
              text: "مراجعة إجابات وأخطاء الاختبار 🔍",
              onPressed: () => context.push('/mistakes'),
            ),
            const SizedBox(height: AppSpacing.sm),
            SecondaryButton(
              width: double.infinity,
              text: "مشاركة النتيجة مع زملائك 📲",
              onPressed: () {
                SharePlus.instance.share(
                  ShareParams(
                    text:
                        "حققت نسبة %${score.toInt()} وحصلت على $earnedPoints نقطة في تطبيق بنك الأسئلة للثالث الثانوي! 🚀",
                  ),
                );
              },
            ),
            const SizedBox(height: AppSpacing.sm),
            OutlineButton(
              width: double.infinity,
              text: "العودة للرئيسية 🏠",
              onPressed: () => context.go('/home'),
            ),
            const SizedBox(height: AppSpacing.xxl),
          ],
        ),
      ),
    );
  }

  Widget _buildStatTile(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          value,
          style: AppTypography.cardTitle.copyWith(
            fontWeight: FontWeight.bold,
            color: color,
            fontSize: 16,
          ),
        ),
        const SizedBox(height: 2),
        Text(label, style: AppTypography.caption.copyWith(fontSize: 10)),
      ],
    );
  }
}
