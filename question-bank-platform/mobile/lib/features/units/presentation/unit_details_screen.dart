import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/models/unit_model.dart';
import '../../../core/models/lesson_model.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../subjects/providers/subject_details_provider.dart';

class UnitDetailsScreen extends ConsumerWidget {
  final String unitId;

  const UnitDetailsScreen({super.key, required this.unitId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unitAsync = ref.watch(unitDetailsProvider(unitId));

    return unitAsync.when(
      loading: () =>
          const AppScaffold(body: Center(child: CircularProgressIndicator())),
      error: (err, _) => AppScaffold(body: Center(child: Text("خطأ: $err"))),
      data: (unit) {
        if (unit == null) {
          return const AppScaffold(
            body: Center(child: Text("الوحدة غير موجودة")),
          );
        }

        // Fetch lessons using joint key "subjectId:unitId"
        final lessonsAsync = ref.watch(
          unitLessonsProvider("${unit.subjectId}:${unit.id}"),
        );

        return AppScaffold(
          appBar: AppBar(
            title: Text(
              unit.name.split(':').first,
            ), // Displays e.g. "الوحدة الأولى"
            leading: IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: () => context.pop(),
            ),
          ),
          body: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // --- UNIT SUMMARY CARD ---
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      unit.name,
                      style: AppTypography.cardTitle.copyWith(
                        fontWeight: FontWeight.bold,
                        fontSize: 17,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(unit.description, style: AppTypography.body),
                    const SizedBox(height: AppSpacing.md),

                    // Progress Indicator
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          "نسبة إنجاز الوحدة",
                          style: AppTypography.caption.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          "${(unit.progressPercent * 100).toInt()}%",
                          style: AppTypography.cardTitle.copyWith(
                            color: AppColors.primaryBlue,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: unit.progressPercent,
                        minHeight: 8,
                        backgroundColor: AppColors.border,
                        valueColor: const AlwaysStoppedAnimation<Color>(
                          AppColors.primaryBlue,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),

              // --- ACTION BUTTONS GRID ---
              Row(
                children: [
                  Expanded(
                    child: PrimaryButton(
                      height: 44,
                      text: "اختبار الوحدة",
                      onPressed: () => context.push(
                        '/quiz/setup?subjectId=${unit.subjectId}&unitId=${unit.id}&scope=unit',
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: SecondaryButton(
                      height: 44,
                      text: "مراجعة الأخطاء",
                      onPressed: () => context.push(
                        '/quiz/setup?subjectId=${unit.subjectId}&unitId=${unit.id}&scope=unit_mistakes',
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),

              Text("دروس الوحدة الدراسية", style: AppTypography.sectionTitle),
              const SizedBox(height: AppSpacing.sm),

              // --- LESSONS LIST ---
              Expanded(
                child: lessonsAsync.when(
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (err, _) =>
                      Center(child: Text("خطأ أثناء تحميل الدروس: $err")),
                  data: (lessons) {
                    if (lessons.isEmpty) {
                      return const Center(
                        child: Text("لا توجد دروس مضافة لهذه الوحدة حالياً."),
                      );
                    }
                    return ListView.builder(
                      itemCount: lessons.length,
                      physics: const BouncingScrollPhysics(),
                      itemBuilder: (context, index) {
                        final lesson = lessons[index];
                        return _buildLessonCard(context, lesson);
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildLessonCard(BuildContext context, LessonModel lesson) {
    final statusConfig = _getLessonStatusConfig(lesson.status);

    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      onTap: () {
        context.push(
          '/subjects/${lesson.subjectId}/units/${lesson.unitId}/lessons/${lesson.id}',
        );
      },
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  lesson.name,
                  style: AppTypography.cardTitle.copyWith(
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: AppSpacing.xxs),
                Row(
                  children: [
                    Text(
                      "${lesson.questionsCount} سؤال",
                      style: AppTypography.caption,
                    ),
                    const SizedBox(width: 8),
                    Container(
                      width: 4,
                      height: 4,
                      decoration: const BoxDecoration(
                        color: AppColors.border,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      "الإتقان: ${(lesson.masteryPercent * 100).toInt()}%",
                      style: AppTypography.caption.copyWith(
                        color: AppColors.successGreen,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),

          // Status Badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: statusConfig.bgColor,
              borderRadius: BorderRadius.circular(AppRadius.pill),
            ),
            child: Text(
              statusConfig.label,
              style: AppTypography.caption.copyWith(
                color: statusConfig.textColor,
                fontWeight: FontWeight.bold,
                fontSize: 10,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          const Icon(
            Icons.arrow_forward_ios,
            size: 14,
            color: AppColors.border,
          ),
        ],
      ),
    );
  }

  ({String label, Color bgColor, Color textColor}) _getLessonStatusConfig(
    String status,
  ) {
    switch (status) {
      case 'mastered':
        return (
          label: "متقن",
          bgColor: AppColors.lightTeal,
          textColor: AppColors.successGreen,
        );
      case 'good':
        return (
          label: "جيد",
          bgColor: AppColors.lightBlue,
          textColor: AppColors.primaryBlue,
        );
      case 'inStudy':
        return (
          label: "قيد الدراسة",
          bgColor: AppColors.lightGold,
          textColor: AppColors.warmOrange,
        );
      case 'needsReview':
        return (
          label: "يحتاج مراجعة",
          bgColor: AppColors.lightError,
          textColor: AppColors.errorCoral,
        );
      case 'notStarted':
      default:
        return (
          label: "لم يبدأ",
          bgColor: AppColors.border.withOpacity(0.4),
          textColor: AppColors.secondaryText,
        );
    }
  }
}
