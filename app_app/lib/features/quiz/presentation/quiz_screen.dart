import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_button.dart';
import '../providers/quiz_provider.dart';

class QuizScreen extends ConsumerWidget {
  const QuizScreen({super.key});

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
            title: const Text("إنهاء الاختبار؟"),
            content: const Text(
              "هل أنت متأكد من رغبتك في الخروج؟ سيتم فقدان تقدمك الحالي في هذا الاختبار.",
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text(
                  "متابعة الاختبار",
                  style: AppTypography.cardTitle.copyWith(
                    color: AppColors.secondaryText,
                  ),
                ),
              ),
              PrimaryButton(
                width: 100,
                height: 40,
                text: "خروج",
                onPressed: () {
                  ref.read(quizNotifierProvider.notifier).cancelQuiz();
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
    final quizState = ref.watch(quizNotifierProvider);
    final quizNotifier = ref.read(quizNotifierProvider.notifier);
    final currentQ = quizState.currentQuestion;
    if (quizState.status == QuizQuestionStatus.completed) {
      Future.microtask(() {
        if (context.mounted) context.go('/quiz/result');
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (quizState.status == QuizQuestionStatus.loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (quizState.status == QuizQuestionStatus.error && currentQ == null) {
      return Scaffold(
        body: Center(
          child: Text(quizState.errorMessage ?? 'تعذر تحميل الاختبار.'),
        ),
      );
    }

    if (currentQ == null) {
      return const Scaffold(body: Center(child: Text("خطأ في تحميل الأسئلة")));
    }

    final isAnswered =
        quizState.status == QuizQuestionStatus.submittedCorrect ||
        quizState.status == QuizQuestionStatus.submittedWrong ||
        quizState.status == QuizQuestionStatus.timedOut;

    final progressVal = quizState.questions.isNotEmpty
        ? (quizState.currentIndex + 1) / quizState.questions.length
        : 0.0;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) _confirmExit(context, ref);
      },
      child: AppScaffold(
        useSafeArea: true,
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios, size: 18),
            onPressed: () => _confirmExit(context, ref),
          ),
          title: Text(
            "سؤال ${quizState.currentIndex + 1} من ${quizState.questions.length}",
            style: AppTypography.sectionTitle.copyWith(
              color: AppColors.primaryBlue,
            ),
          ),
          actions: [
            // Hearts Indicator
            if (quizState.hearts >= 0)
              Padding(
                padding: const EdgeInsets.only(left: 8),
                child: Row(
                  children: List.generate(
                    quizState.maxHearts,
                    (index) => Icon(
                      index < quizState.hearts
                          ? Icons.favorite_rounded
                          : Icons.favorite_border_rounded,
                      color: AppColors.errorCoral,
                      size: 20,
                    ),
                  ),
                ),
              ),

            // Timer Badge
            if (quizState.timerSeconds >= 0)
              Container(
                margin: const EdgeInsets.only(left: 12),
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: quizState.timerSeconds <= 5
                      ? AppColors.lightError
                      : AppColors.lightBlue,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                  border: Border.all(
                    color: quizState.timerSeconds <= 5
                        ? AppColors.errorCoral
                        : AppColors.primaryBlue,
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.timer_outlined,
                      color: quizState.timerSeconds <= 5
                          ? AppColors.errorCoral
                          : AppColors.primaryBlue,
                      size: 16,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      "${quizState.timerSeconds}ث",
                      style: AppTypography.caption.copyWith(
                        color: quizState.timerSeconds <= 5
                            ? AppColors.errorCoral
                            : AppColors.primaryBlue,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
        body: Column(
          children: [
            // Linear Progress Bar
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progressVal,
                minHeight: 6,
                backgroundColor: AppColors.border,
                valueColor: const AlwaysStoppedAnimation<Color>(
                  AppColors.primaryBlue,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.xs),

            // Header Utilities
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.lightBlue,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  child: Text(
                    currentQ.difficulty == 'EASY' ? "🌟 سهل" : currentQ.difficulty == 'HARD' ? "🔥 صعب" : "⭐ متوسط",
                    style: AppTypography.caption.copyWith(color: AppColors.primaryBlue, fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                if (currentQ.isTrickQuestion)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.lightGold,
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                    child: Text(
                      "⚠️ سؤال مفخخ",
                      style: AppTypography.caption.copyWith(
                        color: AppColors.warmOrange,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                if (quizState.attempt?.hintsEnabled == true &&
                    !isAnswered &&
                    !quizState.hintUsed &&
                    currentQ.hintText != null &&
                    currentQ.hintText!.isNotEmpty)
                  TextButton.icon(
                    onPressed: () {
                      quizNotifier.useHint();
                      showDialog(
                        context: context,
                        builder: (_) => AlertDialog(
                          title: const Text('تلميح 💡'),
                          content: Text(currentQ.hintText!),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(context),
                              child: const Text('حسناً'),
                            ),
                          ],
                        ),
                      );
                    },
                    icon: const Icon(Icons.lightbulb_outline_rounded, size: 17),
                    label: const Text('تلميح'),
                  ),                const Spacer(),
                TextButton.icon(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                          "تم إرسال بلاغ عن هذا السؤال للتأكد من المراجعة.",
                        ),
                      ),
                    );
                  },
                  icon: const Icon(
                    Icons.flag_outlined,
                    size: 16,
                    color: AppColors.secondaryText,
                  ),
                  label: Text(
                    "الإبلاغ",
                    style: AppTypography.caption.copyWith(
                      color: AppColors.secondaryText,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),

            // --- QUESTION CARD & OPTIONS ---
            Expanded(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Reading Passage if present
                    if (quizState.currentReadingPassage != null) ...[
                      AppCard(
                        backgroundColor: AppColors.lightBlue,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "القطعة القرائية:",
                              style: AppTypography.caption.copyWith(
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              quizState.currentReadingPassage!.content,
                              style: AppTypography.body.copyWith(
                                height: 1.6,
                                color: AppColors.darkText,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                    ],

                    // Question Text Card
                    AppCard(
                      child: Text(
                        currentQ.questionText,
                        style: AppTypography.cardTitle.copyWith(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                          height: 1.6,
                          color: AppColors.darkText,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),

                    // Options List
                    ...currentQ.options.entries.map((option) {
                      final optionId = option.key;
                      final optionText = option.value;
                      final isSelected = quizState.selectedOptionId == optionId;
                      final revealedCorrectId = currentQ.isTrueFalse
                          ? (quizState.revealedCorrectBoolean == null
                                ? null
                                : quizState.revealedCorrectBoolean!
                                ? 'true'
                                : 'false')
                          : quizState.revealedCorrectOptionId;
                      final isCorrectOption = revealedCorrectId == optionId;

                      Color borderCol = AppColors.border;
                      Color bgCol = AppColors.surface;
                      Widget? statusIcon;

                      if (isAnswered) {
                        if (isCorrectOption) {
                          borderCol = AppColors.successGreen;
                          bgCol = AppColors.lightTeal;
                          statusIcon = const Icon(
                            Icons.check_circle,
                            color: AppColors.successGreen,
                            size: 20,
                          );
                        } else if (isSelected) {
                          borderCol = AppColors.errorCoral;
                          bgCol = AppColors.lightError;
                          statusIcon = const Icon(
                            Icons.cancel,
                            color: AppColors.errorCoral,
                            size: 20,
                          );
                        }
                      } else if (isSelected) {
                        borderCol = AppColors.primaryBlue;
                        bgCol = AppColors.lightBlue;
                      }

                      return GestureDetector(
                        onTap: isAnswered
                            ? null
                            : () => quizNotifier.selectOption(optionId),
                        child: AnimatedContainer(
                          duration: AppDurations.fast,
                          margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.md,
                            vertical: 14,
                          ),
                          decoration: BoxDecoration(
                            color: bgCol,
                            borderRadius: BorderRadius.circular(AppRadius.md),
                            border: Border.all(
                              color: borderCol,
                              width:
                                  isSelected || (isAnswered && isCorrectOption)
                                  ? 2
                                  : 1,
                            ),
                            boxShadow: const [AppShadows.soft],
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 24,
                                height: 24,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: borderCol,
                                    width: 2,
                                  ),
                                  color: isSelected
                                      ? borderCol
                                      : Colors.transparent,
                                ),
                                child: isSelected
                                    ? const Icon(
                                        Icons.check,
                                        size: 14,
                                        color: Colors.white,
                                      )
                                    : null,
                              ),
                              const SizedBox(width: AppSpacing.md),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      optionText,
                                      style: AppTypography.cardTitle.copyWith(
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.darkText,
                                      ),
                                    ),
                                    if (isSelected && isAnswered && !isCorrectOption && quizState.selectedOptionWhyWrong != null && quizState.selectedOptionWhyWrong!.isNotEmpty)
                                      Padding(
                                        padding: const EdgeInsets.only(top: AppSpacing.xs),
                                        child: Text(
                                          "لماذا هذا الخيار خطأ؟\n${quizState.selectedOptionWhyWrong}",
                                          style: AppTypography.caption.copyWith(color: AppColors.errorCoral, fontWeight: FontWeight.bold),
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                              if (statusIcon != null) statusIcon,
                            ],
                          ),
                        ),
                      );
                    }),

                    const SizedBox(height: AppSpacing.sm),
                    if (isAnswered && quizState.explanationShort != null && quizState.explanationShort!.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.sm),
                      AppCard(
                        backgroundColor: AppColors.lightTeal.withValues(alpha: 0.3),
                        border: Border.all(color: AppColors.successGreen.withValues(alpha: 0.2)),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "💡 الشرح والتوضيح",
                              style: AppTypography.caption.copyWith(fontWeight: FontWeight.bold, color: AppColors.successGreen),
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            Text(
                              quizState.explanationShort!,
                              style: AppTypography.body.copyWith(color: AppColors.darkText),
                            ),
                          ],
                        ),
                      ),
                    ],
                    if (isAnswered && quizState.explanationDetailed != null && quizState.explanationDetailed!.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.sm),
                      TextButton.icon(
                        onPressed: () {
                          showModalBottomSheet(
                            context: context,
                            isScrollControlled: true,
                            shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg))),
                            builder: (_) => Padding(
                              padding: EdgeInsets.only(
                                top: AppSpacing.lg,
                                left: AppSpacing.lg,
                                right: AppSpacing.lg,
                                bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.lg,
                              ),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text("الشرح المفصل 📚", style: AppTypography.sectionTitle),
                                  const SizedBox(height: AppSpacing.md),
                                  Flexible(
                                    child: SingleChildScrollView(
                                      child: Text(
                                        quizState.explanationDetailed!,
                                        style: AppTypography.body.copyWith(height: 1.6),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: AppSpacing.lg),
                                  PrimaryButton(
                                    width: double.infinity,
                                    text: "إغلاق",
                                    onPressed: () => Navigator.pop(context),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                        icon: const Icon(Icons.menu_book_rounded),
                        label: const Text("عرض الشرح المفصل"),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.md),
                  ],
                ),
              ),
            ),

            // --- BOTTOM FULL-WIDTH ACTION CONTROLS ---
            Container(
              padding: const EdgeInsets.symmetric(
                vertical: AppSpacing.sm,
                horizontal: AppSpacing.xs,
              ),
              decoration: const BoxDecoration(
                color: AppColors.surface,
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  PrimaryButton(
                    width: double.infinity,
                    height: 48,
                    isLoading:
                        quizState.status == QuizQuestionStatus.submitting,
                    text: isAnswered ? "التالي 🚀" : "تأكيد الإجابة ⚡",
                    onPressed: () {
                      if (!isAnswered) {
                        if (quizState.selectedOptionId != null) {
                          quizNotifier.submitAnswer();
                        }
                      } else {
                        quizNotifier.nextQuestion();
                      }
                    },
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Row(
                    children: [
                      Expanded(
                        child: OutlineButton(
                          height: 40,
                          text: "حفظ السؤال 🔖",
                          onPressed: () {
                            quizNotifier.toggleSaveCurrentQuestion();
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text("تم حفظ السؤال للمراجعة"),
                              ),
                            );
                          },
                        ),
                      ),
                      if (quizState.currentIndex > 0) ...[
                        const SizedBox(width: 8),
                        Expanded(
                          child: SecondaryButton(
                            height: 40,
                            text: "السابق",
                            onPressed: () => quizNotifier.previousQuestion(),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
