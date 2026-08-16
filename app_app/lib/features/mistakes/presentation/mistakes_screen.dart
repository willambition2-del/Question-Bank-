import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/design_tokens.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/error_state.dart';
import '../../auth/providers/auth_provider.dart';
import '../../quiz/providers/quiz_provider.dart';
import '../providers/mistakes_provider.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_chip.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/network/progress_api_models.dart';

class MistakesScreen extends ConsumerWidget {
  const MistakesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(mistakesNotifierProvider);
    final notifier = ref.read(mistakesNotifierProvider.notifier);
    final records = notifier.getFilteredMistakes();
    return AppScaffold(
      appBar: AppBar(
        title: const Text('مراجعة الأخطاء'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, size: 18),
          onPressed: () => context.pop(),
        ),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: AppSpacing.xs),
          AppCard(
            backgroundColor: AppColors.surface,
            border: Border.all(
              color: AppColors.primaryBlue.withValues(alpha: 0.3),
              width: 1.5,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "مراجعة الأخطاء",
                        style: AppTypography.sectionTitle.copyWith(
                          color: AppColors.primaryBlue,
                          fontSize: 15,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        "الأخطاء فرصتك الذهبية للتعلم والسيطرة على نقاط الضعف قبل الامتحان النهائي!",
                        style: AppTypography.caption.copyWith(
                          color: AppColors.darkText,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.xs),
                const Icon(
                  Icons.error_outline_rounded,
                  color: AppColors.warmOrange,
                  size: 48,
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                AppChip(
                  label: 'الكل (${state.meta?.totalItems ?? records.length})',
                  isSelected: state.selectedSubjectId == null,
                  onSelected: (_) => notifier.selectSubject(null),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Expanded(
            child: state.mistakes.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, stackTrace) => ErrorState(
                message: 'حدث خطأ أثناء تحميل سجل الأخطاء.',
                onRetry: notifier.loadMistakes,
              ),
              data: (items) {
                if (items.isEmpty) {
                  return const EmptyState(
                    title: 'لا توجد أخطاء للمراجعة',
                    message:
                        'ستظهر هنا الأسئلة التي تحتاج إلى مراجعة بعد حل الاختبارات.',
                  );
                }
                return ListView.builder(
                  itemCount: items.length,
                  physics: const BouncingScrollPhysics(),
                  itemBuilder: (context, index) => _MistakeCard(
                    record: items[index],
                    index: index + 1,
                  ),
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
            child: PrimaryButton(
              width: double.infinity,
              text: 'إنشاء اختبار من الأخطاء 🎯',
              isLoading: state.actionInProgress,
              onPressed: records.isEmpty
                  ? null
                  : () async {
                      final started = await ref
                          .read(quizNotifierProvider.notifier)
                          .startQuiz(
                            scope: 'MISTAKES',
                            subjectId: state.selectedSubjectId,
                            count: records.length,
                            difficulty: 'MIXED',
                            type: 'mixed',
                            useTimer: false,
                            timerLimitSeconds: 30,
                          );
                      if (!context.mounted) return;
                      final quiz = ref.read(quizNotifierProvider);
                      if (started) {
                        context.push('/quiz');
                      } else {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              quiz.errorMessage ??
                                  'تعذر إنشاء اختبار من الأخطاء.',
                            ),
                          ),
                        );
                      }
                    },
            ),
          ),
        ],
      ),
    );
  }
}

class _MistakeCard extends StatelessWidget {
  final MistakeRecord record;
  final int index;

  const _MistakeCard({
    required this.record,
    required this.index,
  });

  @override
  Widget build(BuildContext context) {
    final mastery = (record.masteryScore * 100).clamp(0, 100).round();
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.lightError,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                child: Text(
                  'سؤال $index',
                  style: AppTypography.caption.copyWith(
                    color: AppColors.errorCoral,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const Spacer(),
              Text(
                'تكرر الخطأ ${record.wrongCount} مرات',
                style: AppTypography.caption.copyWith(
                  color: AppColors.errorCoral,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            record.question.questionText,
            style: AppTypography.cardTitle.copyWith(
              fontWeight: FontWeight.bold,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('الإتقان الحالي: $mastery%', style: AppTypography.caption),
            ],
          ),
        ],
      ),
    );
  }
}
