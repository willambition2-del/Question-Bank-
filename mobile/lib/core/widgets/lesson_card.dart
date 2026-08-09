import 'package:flutter/material.dart';
import '../../app/theme/design_tokens.dart';
import 'app_card.dart';

class LessonCard extends StatelessWidget {
  final String name;
  final int questionsCount;
  final double progress;
  final double mastery;
  final int mistakesCount;
  final VoidCallback onStartQuiz;
  final VoidCallback? onReviewMistakes;

  const LessonCard({
    super.key,
    required this.name,
    required this.questionsCount,
    required this.progress,
    required this.mastery,
    required this.mistakesCount,
    required this.onStartQuiz,
    this.onReviewMistakes,
  });

  @override
  Widget build(BuildContext context) {
    final progressPct = (progress * 100).toInt();

    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  name,
                  style: AppTypography.cardTitle.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              if (mistakesCount > 0)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.lightError,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  child: Text(
                    '$mistakesCount أخطاء',
                    style: AppTypography.caption.copyWith(
                      color: AppColors.errorCoral,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            '$questionsCount سؤالاً متوفراً  •  الإتقان: %${(mastery * 100).toInt()}',
            style: AppTypography.caption,
          ),
          const SizedBox(height: AppSpacing.xs),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              backgroundColor: AppColors.border,
              valueColor: AlwaysStoppedAnimation<Color>(
                progress > 0.7 ? AppColors.successGreen : AppColors.primaryBlue,
              ),
              minHeight: 5,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: onStartQuiz,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryBlue,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                  child: const Text(
                    'ابدأ اختبار الدرس',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ),
              ),
              if (mistakesCount > 0 && onReviewMistakes != null) ...[
                const SizedBox(width: AppSpacing.xs),
                OutlinedButton(
                  onPressed: onReviewMistakes,
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.errorCoral),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                  ),
                  child: const Text(
                    'مراجعة الأخطاء',
                    style: TextStyle(
                      color: AppColors.errorCoral,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
