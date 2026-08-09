import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/models/exam_model.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../providers/exam_models_provider.dart';

class ExamModelsScreen extends ConsumerStatefulWidget {
  const ExamModelsScreen({super.key});

  @override
  ConsumerState<ExamModelsScreen> createState() => _ExamModelsScreenState();
}

class _ExamModelsScreenState extends ConsumerState<ExamModelsScreen> {
  int _selectedTabIndex = 3; // Default to "النماذج" (Index 3)
  String? _selectedExamId;

  final List<String> _tabs = ["المواد", "الوحدات", "الدروس", "النماذج"];

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(examModelsNotifierProvider);
    final notifier = ref.read(examModelsNotifierProvider.notifier);
    final filteredExams = notifier.getFilteredExams();

    return AppScaffold(
      appBar: AppBar(
        title: const Text("النماذج الامتحانية الوزارية"),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: AppSpacing.xs),

          // --- TOP SEGMENTED CONTROL TABS ---
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(AppRadius.pill),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: List.generate(_tabs.length, (index) {
                final isSelected = index == _selectedTabIndex;
                return Expanded(
                  child: GestureDetector(
                    onTap: () {
                      setState(() {
                        _selectedTabIndex = index;
                      });
                      if (index == 0) context.push('/subjects');
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppColors.primaryBlue
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                      ),
                      child: Text(
                        _tabs[index],
                        textAlign: TextAlign.center,
                        style: AppTypography.caption.copyWith(
                          color: isSelected ? Colors.white : AppColors.darkText,
                          fontWeight: isSelected
                              ? FontWeight.bold
                              : FontWeight.normal,
                        ),
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),
          const SizedBox(height: AppSpacing.md),

          // --- MODEL EXAMS LIST ---
          Expanded(
            child: state.exams.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, _) => Center(child: Text("خطأ: $err")),
              data: (_) {
                if (filteredExams.isEmpty) {
                  return const Center(
                    child: Text("لا توجد نماذج وزارية مجهزة حالياً"),
                  );
                }
                return ListView.builder(
                  itemCount: filteredExams.length,
                  physics: const BouncingScrollPhysics(),
                  itemBuilder: (context, index) {
                    final exam = filteredExams[index];
                    final isSelected = _selectedExamId == exam.id;

                    return _buildExamCard(context, exam, isSelected);
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildExamCard(BuildContext context, ExamModel exam, bool isSelected) {
    final hasScore = exam.bestScore != null;

    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      onTap: () {
        setState(() {
          _selectedExamId = exam.id;
        });
      },
      border: Border.all(
        color: isSelected ? AppColors.primaryBlue : AppColors.border,
        width: isSelected ? 2 : 1,
      ),
      backgroundColor: isSelected
          ? AppColors.lightBlue
          : AppColors.cardBackground,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row: Title & Completion Status Badge
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.xs),
                decoration: BoxDecoration(
                  color: AppColors.primaryBlue.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
                child: const Icon(
                  Icons.assignment_outlined,
                  color: AppColors.primaryBlue,
                  size: 24,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      exam.title,
                      style: AppTypography.cardTitle.copyWith(
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "سنة ${exam.year}  •  ${exam.sourceId}",
                      style: AppTypography.caption.copyWith(
                        color: AppColors.primaryBlue,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: exam.isCompleted
                      ? AppColors.lightTeal
                      : AppColors.lightGold,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                child: Text(
                  exam.isCompleted ? "مكتمل ✅" : "جديد 🆕",
                  style: AppTypography.caption.copyWith(
                    color: exam.isCompleted
                        ? AppColors.successGreen
                        : AppColors.warmOrange,
                    fontWeight: FontWeight.bold,
                    fontSize: 10,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),

          // Exam Info Row: Questions Count, Duration & Best Score
          Row(
            children: [
              _buildInfoCol("عدد الأسئلة", "${exam.questionsCount} سؤال"),
              _buildVerticalDivider(),
              _buildInfoCol("زمن الاختبار", "${exam.durationMinutes} دقيقة"),
              _buildVerticalDivider(),
              _buildInfoCol(
                "أفضل نتيجة",
                hasScore ? "${exam.bestScore!.toInt()}%" : "--",
                valueColor: hasScore
                    ? AppColors.successGreen
                    : AppColors.mutedText,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),

          // Action Button Row
          Row(
            children: [
              Expanded(
                child: PrimaryButton(
                  height: 40,
                  text: exam.isCompleted || hasScore
                      ? "متابعة النموذج 🔄"
                      : "ابدأ النموذج 🚀",
                  onPressed: () {
                    context.push('/quiz/setup?examModelId=${exam.id}');
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCol(String label, String value, {Color? valueColor}) {
    return Expanded(
      child: Column(
        children: [
          Text(label, style: AppTypography.caption.copyWith(fontSize: 10)),
          const SizedBox(height: 2),
          Text(
            value,
            style: AppTypography.cardTitle.copyWith(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: valueColor ?? AppColors.darkText,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVerticalDivider() {
    return Container(height: 20, width: 1, color: AppColors.border);
  }
}
