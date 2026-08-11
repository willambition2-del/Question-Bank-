import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/models/companion_enums.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/character_companion.dart';
import '../providers/challenge_provider.dart';
import '../../auth/providers/auth_provider.dart';

class ChallengeLiveScreen extends ConsumerWidget {
  const ChallengeLiveScreen({super.key});

  void _confirmExit(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            title: const Text("انسحاب من التحدي؟"),
            content: const Text(
              "هل تريد حقاً الانسحاب من هذه المباراة؟ الانسحاب يعادل الخسارة وستفقد نقاطاً.",
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text(
                  "متابعة التحدي",
                  style: AppTypography.cardTitle.copyWith(
                    color: AppColors.secondaryText,
                  ),
                ),
              ),
              PrimaryButton(
                width: 100,
                height: 40,
                text: "انسحاب",
                onPressed: () {
                  ref.read(challengeProvider.notifier).exitMatch();
                  Navigator.of(context).pop();
                  context.go('/home');
                },
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(challengeProvider);
    final notifier = ref.read(challengeProvider.notifier);
    final student = ref.watch(authProvider);
    final companion = student?.selectedCompanionType ?? CompanionType.male;

    final currentQ = state.currentQuestion;

    // --- COMPLETED STATE OVERLAY ---
    if (state.status == 'completed') {
      final playerWon = state.playerScore >= state.opponentScore;
      final isDraw = state.playerScore == state.opponentScore;

      CharacterEmotion endEmotion = CharacterEmotion.victory;
      String endGreeting = "أنت الفائز البطل! 🏆";
      Color endColor = AppColors.successGreen;
      Color endLightColor = AppColors.lightTeal;

      if (isDraw) {
        endEmotion = CharacterEmotion.neutral;
        endGreeting = "تعادل حماسي! 🤝";
        endColor = AppColors.primaryBlue;
        endLightColor = AppColors.lightBlue;
      } else if (!playerWon) {
        endEmotion = CharacterEmotion.defeatSportsmanship;
        endGreeting = "معوض خير يا بطل! 👏";
        endColor = AppColors.errorCoral;
        endLightColor = AppColors.lightError;
      }

      return PopScope(
        canPop: false,
        child: AppScaffold(
          useSafeArea: true,
          body: Center(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text("انتهى التحدي المباشر", style: AppTypography.pageTitle),
                  const SizedBox(height: AppSpacing.md),

                  // Final Card
                  AppCard(
                    backgroundColor: endLightColor,
                    border: Border.all(color: endColor.withValues(alpha: 0.2)),
                    child: Column(
                      children: [
                        CharacterCompanion(
                          companionType: companion,
                          emotion: endEmotion,
                          message: playerWon && !isDraw
                              ? "مبارك الفوز الرائع! أثبتَّ سرعة استجابتك ودقتك وحصلت على +50 نقطة مكافأة."
                              : isDraw
                              ? "مباراة متكافئة وقوية جداً. منافسك كان نداً قوياً!"
                              : "خسارة بروح رياضية! راجع أخطاءك وستنتصر في المرة القادمة.",
                          size: CharacterSize.medium,
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          endGreeting,
                          style: AppTypography.pageTitle.copyWith(
                            color: endColor,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  // Final Scores Comparer
                  AppCard(
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            children: [
                              Text("نقاطك", style: AppTypography.caption),
                              Text(
                                "${state.playerScore}",
                                style: AppTypography.displayLarge.copyWith(
                                  color: AppColors.primaryBlue,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          width: 1,
                          height: 50,
                          color: AppColors.border,
                        ),
                        Expanded(
                          child: Column(
                            children: [
                              Text(
                                "نقاط ${state.opponent?.name}",
                                style: AppTypography.caption,
                              ),
                              Text(
                                "${state.opponentScore}",
                                style: AppTypography.displayLarge.copyWith(
                                  color: AppColors.errorCoral,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  PrimaryButton(
                    width: double.infinity,
                    text: "العودة لساحة التحديات",
                    onPressed: () {
                      notifier.exitMatch();
                      context.go('/home');
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    if (currentQ == null) {
      return const Scaffold(body: Center(child: Text("خطأ في التحميل")));
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) _confirmExit(context, ref);
      },
      child: AppScaffold(
        useSafeArea: true,
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.close),
            onPressed: () => _confirmExit(context, ref),
          ),
          title: Text(
            "السؤال ${state.questionIndex + 1} من 10",
            style: AppTypography.sectionTitle,
          ),
        ),
        body: Column(
          children: [
            // --- TOP HEAD-TO-HEAD DISPLAY ---
            AppCard(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
              child: Row(
                children: [
                  // Player Score Col
                  Expanded(
                    child: Column(
                      children: [
                        Text(
                          student?.name.split(' ').first ?? "أحمد",
                          style: AppTypography.caption.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          "${state.playerScore}",
                          style: AppTypography.pageTitle.copyWith(
                            color: AppColors.primaryBlue,
                            fontSize: 22,
                          ),
                        ),
                        Text(
                          state.hasPlayerAnswered ? "أجبت ✅" : "تفكر...",
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: state.hasPlayerAnswered
                                ? AppColors.successGreen
                                : AppColors.secondaryText,
                            fontFamily: 'Cairo',
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Central Timer Circle
                  Container(
                        padding: const EdgeInsets.all(AppSpacing.sm),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: state.timerSeconds <= 3
                              ? AppColors.lightError
                              : AppColors.lightBlue,
                          border: Border.all(
                            color: state.timerSeconds <= 3
                                ? AppColors.errorCoral
                                : AppColors.primaryBlue,
                            width: 2,
                          ),
                        ),
                        child: Text(
                          "${state.timerSeconds}ث",
                          style: AppTypography.cardTitle.copyWith(
                            color: state.timerSeconds <= 3
                                ? AppColors.errorCoral
                                : AppColors.primaryBlue,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      )
                      .animate(target: state.timerSeconds <= 3 ? 1 : 0)
                      .shake(duration: 400.ms, hz: 6),

                  // Opponent Score Col
                  Expanded(
                    child: Column(
                      children: [
                        Text(
                          state.opponent?.name.split(' ').first ?? "المنافس",
                          style: AppTypography.caption.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          "${state.opponentScore}",
                          style: AppTypography.pageTitle.copyWith(
                            color: AppColors.errorCoral,
                            fontSize: 22,
                          ),
                        ),
                        Text(
                          state.opponentStatus == 'thinking'
                              ? "يفكر... 💬"
                              : state.opponentStatus == 'answered'
                              ? "أجاب! ⚡"
                              : "انتهى الوقت ⏰",
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: state.opponentStatus == 'answered'
                                ? AppColors.successGreen
                                : AppColors.secondaryText,
                            fontFamily: 'Cairo',
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.sm),

            // --- PROGRESS BAR ---
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: (state.questionIndex + 1) / 10,
                minHeight: 5,
                backgroundColor: AppColors.border,
                valueColor: const AlwaysStoppedAnimation<Color>(
                  AppColors.primaryBlue,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            // --- QUESTION CARD ---
            Expanded(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                child: Column(
                  children: [
                    AppCard(
                      child: Text(
                        currentQ.questionText,
                        style: AppTypography.cardTitle.copyWith(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),

                    // Options list
                    ...currentQ.options.entries.map((option) {
                      final optionId = option.key;
                      final optionText = option.value;
                      final isSelected = state.selectedOptionId == optionId;
                      Color borderCol = AppColors.border;
                      Color bgCol = AppColors.surface;
                      Widget? statusIcon;

                      if (state.status == 'results' && isSelected) {
                        final correct = state.playerLastCorrect == true;
                        borderCol = correct
                            ? AppColors.successGreen
                            : AppColors.errorCoral;
                        bgCol = correct
                            ? AppColors.lightTeal
                            : AppColors.lightError;
                        statusIcon = Icon(
                          correct ? Icons.check_circle : Icons.cancel,
                          color: correct
                              ? AppColors.successGreen
                              : AppColors.errorCoral,
                          size: 20,
                        );
                      } else {
                        if (isSelected) {
                          borderCol = AppColors.primaryBlue;
                          bgCol = AppColors.lightBlue;
                        }
                      }

                      return GestureDetector(
                        onTap:
                            state.hasPlayerAnswered || state.status == 'results'
                            ? null
                            : () => notifier.submitPlayerAnswer(optionId),
                        child: Container(
                          margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.md,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            color: bgCol,
                            borderRadius: BorderRadius.circular(AppRadius.md),
                            border: Border.all(
                              color: borderCol,
                              width: isSelected ? 2 : 1,
                            ),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 26,
                                height: 26,
                                decoration: BoxDecoration(
                                  color: isSelected
                                      ? AppColors.primaryBlue
                                      : AppColors.background,
                                  shape: BoxShape.circle,
                                ),
                                child: Center(
                                  child: Text(
                                    optionId,
                                    style: TextStyle(
                                      color: isSelected
                                          ? Colors.white
                                          : AppColors.darkText,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: AppSpacing.md),
                              Expanded(
                                child: Text(
                                  optionText,
                                  style: AppTypography.cardTitle.copyWith(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                              if (statusIcon != null) ...[
                                const SizedBox(width: AppSpacing.xs),
                                statusIcon,
                              ],
                            ],
                          ),
                        ),
                      );
                    }),

                    // --- ROUND OUTCOME DISPLAY ---
                    if (state.status == 'results') ...[
                      const SizedBox(height: AppSpacing.md),
                      AppCard(
                        backgroundColor: AppColors.background,
                        child: Column(
                          children: [
                            Text(
                              "نتيجة الجولة",
                              style: AppTypography.cardTitle.copyWith(
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceAround,
                              children: [
                                Row(
                                  children: [
                                    const Text(
                                      "أنت: ",
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    Icon(
                                      state.playerLastCorrect == true
                                          ? Icons.check_circle
                                          : Icons.cancel,
                                      color: state.playerLastCorrect == true
                                          ? AppColors.successGreen
                                          : AppColors.errorCoral,
                                      size: 18,
                                    ),
                                  ],
                                ),
                                Text(
                                  "تم تحديث نقاط المنافس من الخادم",
                                  style: AppTypography.caption,
                                ),
                              ],
                            ),
                          ],
                        ),
                      ).animate().fadeIn().slideY(begin: 0.2, end: 0),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
