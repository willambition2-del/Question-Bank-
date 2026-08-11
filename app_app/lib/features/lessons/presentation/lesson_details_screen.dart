import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/models/lesson_model.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../subjects/providers/subject_details_provider.dart';

class LessonDetailsScreen extends ConsumerWidget {
  final String lessonId;

  const LessonDetailsScreen({super.key, required this.lessonId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lessonAsync = ref.watch(lessonDetailsProvider(lessonId));

    return lessonAsync.when(
      loading: () =>
          const AppScaffold(body: Center(child: CircularProgressIndicator())),
      error: (err, _) => AppScaffold(body: Center(child: Text("خطأ: $err"))),
      data: (lesson) {
        if (lesson == null) {
          return const AppScaffold(
            body: Center(child: Text("الدرس غير موجود")),
          );
        }

        return AppScaffold(
          appBar: AppBar(
            title: const Text("تفاصيل الدرس"),
            leading: IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: () => context.pop(),
            ),
          ),
          body: SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // --- LESSON CARD ---
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        lesson.name,
                        style: AppTypography.cardTitle.copyWith(
                          fontWeight: FontWeight.bold,
                          fontSize: 17,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(lesson.description, style: AppTypography.body),
                      const SizedBox(height: AppSpacing.md),

                      // Mastery and solved questions
                      Row(
                        children: [
                          _buildStatCol(
                            "مستوى الإتقان",
                            "${(lesson.masteryPercent * 100).toInt()}%",
                            AppColors.successGreen,
                          ),
                          _buildVerticalDivider(),
                          _buildStatCol(
                            "الصحيحة",
                            "${lesson.correctCount}",
                            AppColors.primaryBlue,
                          ),
                          _buildVerticalDivider(),
                          _buildStatCol(
                            "الخاطئة",
                            "${lesson.wrongCount}",
                            AppColors.errorCoral,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),

                // --- TEST BUTTONS GRID ---
                Row(
                  children: [
                    Expanded(
                      child: PrimaryButton(
                        height: 44,
                        text: "اختبار 10 أسئلة",
                        onPressed: () => context.push(
                          '/quiz/setup?subjectId=${lesson.subjectId}&unitId=${lesson.unitId}&lessonId=${lesson.id}&scope=lesson&count=10',
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: PrimaryButton(
                        height: 44,
                        text: "اختبار 20 سؤالاً",
                        onPressed: () => context.push(
                          '/quiz/setup?subjectId=${lesson.subjectId}&unitId=${lesson.unitId}&lessonId=${lesson.id}&scope=lesson&count=20',
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Expanded(
                      child: SecondaryButton(
                        height: 44,
                        text: "مراجعة أخطاء الدرس",
                        onPressed: () => context.push(
                          '/quiz/setup?subjectId=${lesson.subjectId}&unitId=${lesson.unitId}&lessonId=${lesson.id}&scope=lesson_mistakes',
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: OutlineButton(
                        height: 44,
                        text: "تحدي زميل بالدرس",
                        onPressed: () => context.push(
                          '/challenges/waiting?subjectId=${lesson.subjectId}&unitId=${lesson.unitId}&lessonId=${lesson.id}',
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),

                AppCard(
                  backgroundColor: AppColors.lightBlue,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text('مساعد الدرس', style: AppTypography.sectionTitle),
                      const SizedBox(height: AppSpacing.sm),
                      Row(
                        children: [
                          Expanded(
                            child: SecondaryButton(
                              height: 44,
                              text: 'لخّص الدرس',
                              onPressed: () => context.push(
                                '/assistant?lessonId=${lesson.id}&action=summarize',
                              ),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: OutlineButton(
                              height: 44,
                              text: 'بسّط الدرس',
                              onPressed: () => context.push(
                                '/assistant?lessonId=${lesson.id}&action=simplify',
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                // --- CORE CONCEPTS ---
                Text(
                  "أهم النقاط والمفاهيم في الدرس",
                  style: AppTypography.sectionTitle,
                ),
                const SizedBox(height: AppSpacing.sm),
                AppCard(
                  child: Column(
                    children: [
                      _buildConceptItem(
                        "المفاهيم الفيزيائية لكمية التحرك والاندفاع.",
                        true,
                      ),
                      const Divider(height: AppSpacing.md),
                      _buildConceptItem(
                        "مبرهنة الدفع وتأثير القوة الزمنية على حركة الأجسام.",
                        true,
                      ),
                      const Divider(height: AppSpacing.md),
                      _buildConceptItem(
                        "حل مسائل تصادم الكرات في بعدين زاوية.",
                        false,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),

                // --- PAST ATTEMPTS ---
                Text(
                  "آخر محاولاتك في هذا الدرس",
                  style: AppTypography.sectionTitle,
                ),
                const SizedBox(height: AppSpacing.sm),
                AppCard(
                  child: Column(
                    children: [
                      _buildAttemptRow(
                        "منذ يومين",
                        "النتيجة: 80% (8/10 إجابات صحيحة)",
                        AppColors.successGreen,
                      ),
                      const Divider(height: AppSpacing.md),
                      _buildAttemptRow(
                        "منذ 5 أيام",
                        "النتيجة: 40% (4/10 إجابات صحيحة)",
                        AppColors.errorCoral,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.xxl),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildStatCol(String label, String value, Color color) {
    return Expanded(
      child: Column(
        children: [
          Text(label, style: AppTypography.caption),
          const SizedBox(height: 2),
          Text(
            value,
            style: AppTypography.cardTitle.copyWith(
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVerticalDivider() {
    return Container(height: 24, width: 1, color: AppColors.border);
  }

  Widget _buildConceptItem(String text, bool isReviewed) {
    return Row(
      children: [
        Icon(
          isReviewed ? Icons.verified : Icons.radio_button_unchecked,
          color: isReviewed ? AppColors.primaryBlue : AppColors.border,
          size: 20,
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Text(
            text,
            style: AppTypography.body.copyWith(
              color: AppColors.darkText,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildAttemptRow(String date, String scoreStr, Color color) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(date, style: AppTypography.caption),
        Text(
          scoreStr,
          style: AppTypography.body.copyWith(
            color: color,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }
}
