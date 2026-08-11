import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/design_tokens.dart';
import '../../../core/models/companion_enums.dart';
import '../../../core/network/progress_api_models.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_chip.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/character_companion.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/error_state.dart';
import '../../auth/providers/auth_provider.dart';
import '../../quiz/providers/quiz_provider.dart';
import '../providers/saved_questions_provider.dart';

class SavedQuestionsScreen extends ConsumerWidget {
  const SavedQuestionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(savedQuestionsNotifierProvider);
    final notifier = ref.read(savedQuestionsNotifierProvider.notifier);
    final records = notifier.getFilteredSavedQuestions();
    final student = ref.watch(authProvider);
    final companion = student?.selectedCompanionType ?? CompanionType.male;

    return AppScaffold(
      appBar: AppBar(
        title: const Text('الأسئلة المحفوظة للمراجعة'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: AppSpacing.sm),
          AppCard(
            backgroundColor: AppColors.lightTeal,
            border: Border.all(
              color: AppColors.secondaryTeal.withValues(alpha: 0.15),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'أسئلتك المحفوظة للمراجعة',
                        style: AppTypography.cardTitle.copyWith(
                          color: AppColors.secondaryTeal,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        'أضف ملاحظاتك الخاصة لكل سؤال واستعد لمراجعة مفاهيمك.',
                        style: AppTypography.body.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                CharacterCompanion(
                  companionType: companion,
                  emotion: CharacterEmotion.hint,
                  size: CharacterSize.small,
                  showBubble: false,
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
          if (records.isNotEmpty) ...[
            PrimaryButton(
              width: double.infinity,
              text: 'إنشاء اختبار من المحفوظات (${records.length} أسئلة) 📝',
              isLoading: state.actionInProgress,
              onPressed: () async {
                final started = await ref
                    .read(quizNotifierProvider.notifier)
                    .startQuiz(
                      scope: 'SAVED',
                      subjectId: state.selectedSubjectId,
                      count: records.length,
                      difficulty: 'MIXED',
                      type: 'mixed',
                      useHearts: false,
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
                            'تعذر إنشاء اختبار من الأسئلة المحفوظة.',
                      ),
                    ),
                  );
                }
              },
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          Expanded(
            child: state.savedQuestions.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, stackTrace) => ErrorState(
                message: 'حدث خطأ أثناء تحميل الأسئلة المحفوظة.',
                onRetry: notifier.loadSavedQuestions,
              ),
              data: (items) {
                if (items.isEmpty) {
                  return const EmptyState(
                    title: 'لا توجد أسئلة محفوظة',
                    message:
                        'اضغط على زر حفظ السؤال أثناء الاختبار لتجده هنا لاحقًا.',
                    emotion: CharacterEmotion.waiting,
                  );
                }
                return ListView.builder(
                  itemCount: items.length,
                  physics: const BouncingScrollPhysics(),
                  itemBuilder: (context, index) => _SavedQuestionCard(
                    record: items[index],
                    onRemove: () =>
                        notifier.unsaveQuestion(items[index].question.id),
                    onUpdateNote: (note) =>
                        notifier.updateNote(items[index].question.id, note),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _SavedQuestionCard extends StatelessWidget {
  final SavedQuestionRecord record;
  final Future<void> Function() onRemove;
  final Future<void> Function(String? note) onUpdateNote;

  const _SavedQuestionCard({
    required this.record,
    required this.onRemove,
    required this.onUpdateNote,
  });

  @override
  Widget build(BuildContext context) {
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
                  color: AppColors.lightTeal,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  record.question.difficulty,
                  style: AppTypography.caption.copyWith(
                    color: AppColors.secondaryTeal,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const Spacer(),
              IconButton(
                constraints: const BoxConstraints(),
                padding: EdgeInsets.zero,
                icon: const Icon(
                  Icons.bookmark_remove_outlined,
                  color: AppColors.errorCoral,
                  size: 20,
                ),
                onPressed: onRemove,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            record.question.questionText,
            style: AppTypography.cardTitle.copyWith(
              fontWeight: FontWeight.bold,
              fontSize: 14,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: AppSpacing.xs),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.lightGold,
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.edit_note_rounded,
                  color: AppColors.warmOrange,
                  size: 18,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    record.note?.isNotEmpty == true
                        ? 'ملاحظتك: ${record.note}'
                        : 'لا توجد ملاحظة',
                    style: AppTypography.caption.copyWith(
                      color: AppColors.darkText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                IconButton(
                  constraints: const BoxConstraints(),
                  padding: EdgeInsets.zero,
                  icon: const Icon(
                    Icons.edit,
                    size: 14,
                    color: AppColors.primaryBlue,
                  ),
                  onPressed: () => _editNote(context),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          const Divider(height: 1),
          Center(
            child: TextButton.icon(
              onPressed: () => _showQuestion(context),
              icon: const Icon(Icons.visibility_outlined, size: 16),
              label: const Text('عرض تفاصيل السؤال'),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _editNote(BuildContext context) async {
    final controller = TextEditingController(text: record.note ?? '');
    final note = await showDialog<String?>(
      context: context,
      builder: (dialogContext) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          title: const Text('تعديل ملاحظة السؤال'),
          content: TextField(
            controller: controller,
            maxLines: 3,
            maxLength: 1000,
            decoration: const InputDecoration(
              hintText: 'اكتب ملاحظة تساعدك عند المراجعة...',
              border: OutlineInputBorder(),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('إلغاء'),
            ),
            PrimaryButton(
              height: 38,
              width: 90,
              text: 'حفظ',
              onPressed: () => Navigator.of(dialogContext).pop(
                controller.text.trim().isEmpty ? null : controller.text.trim(),
              ),
            ),
          ],
        ),
      ),
    );
    controller.dispose();
    if (!context.mounted) return;
    await onUpdateNote(note);
  }

  void _showQuestion(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          title: const Text('مراجعة السؤال المحفوظ'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(record.question.questionText),
                const SizedBox(height: AppSpacing.md),
                for (final option in record.question.options.values)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: AppCard(
                      backgroundColor: AppColors.background,
                      child: Text(option),
                    ),
                  ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'يظهر الحل فقط عندما يسمح به الخادم أثناء الاختبار.',
                  style: AppTypography.caption,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('إغلاق'),
            ),
          ],
        ),
      ),
    );
  }
}
