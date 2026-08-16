import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/widgets/subject_card.dart';
import '../providers/curriculum_provider.dart';

class CurriculumSubjectsScreen extends ConsumerWidget {
  const CurriculumSubjectsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subjectsAsync = ref.watch(curriculumSubjectsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text('المنهج الدراسي', style: AppTypography.pageTitle),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: subjectsAsync.when(
        data: (subjects) {
          if (subjects.isEmpty) {
            return const Center(
              child: Text(
                'لا توجد مواد متاحة حالياً',
              ),
            );
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'اختر المادة لتصفح الملازم والكتب',
                  style: AppTypography.sectionTitle,
                ),
                const SizedBox(height: AppSpacing.md),
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 0.85,
                    crossAxisSpacing: AppSpacing.md,
                    mainAxisSpacing: AppSpacing.md,
                  ),
                  itemCount: subjects.length,
                  itemBuilder: (context, index) {
                    final subject = subjects[index];
                    return SubjectCard(
                      subjectId: subject.id,
                      title: subject.name,
                      unitsCount: subject.unitsCount,
                      lessonsCount: subject.lessonsCount,
                      progress: subject.progressPercent,
                      mastery: subject.masteryPercent,
                      isFavorite: subject.isFavorite,
                      onTap: () {
                        context.push('/curriculum-resources/${subject.id}', extra: subject);
                      },
                    );
                  },
                ),
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(
          child: Text('حدث خطأ: $err'),
        ),
      ),
    );
  }
}
