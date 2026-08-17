import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../app/router/tab_index_provider.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/widgets/stat_card.dart';
import '../../auth/providers/auth_provider.dart';
import '../providers/home_dashboard_provider.dart';
import '../../notifications/providers/notifications_provider.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final student = ref.watch(authProvider);
    final dashboard = ref.watch(homeDashboardProvider);
    final unreadNotifications =
        ref.watch(notificationInboxProvider).value?.unreadCount ?? 0;
    final overview = dashboard.overview.value;
    final pointsProfile = dashboard.points.value;
    final tasks = dashboard.dailyTasks.value ?? const [];
    final recommendations = dashboard.recommendations.value;
    final userName = student?.name ?? 'الطالب';
    final points = pointsProfile?.currentPoints ?? overview?.totalPoints;
    final level = pointsProfile?.currentLevel ?? overview?.level;
    final streak = overview?.currentStreakDays;
    final rank = overview?.rank;
    final completedTasks = tasks.where((task) => task.isCompleted).length;
    final planProgress = tasks.isEmpty ? 0.0 : completedTasks / tasks.length;
    final dailyTask = tasks.isEmpty ? null : tasks.first;
    final recommendedLesson = recommendations?.lessons.firstOrNull;


    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Header
          AppHeader(
            userName: userName,
            message: "مرحباً بك مجدداً! جاهز للتحدي اليوم؟",
            unreadNotifications: unreadNotifications,
            onNotificationTap: () => context.push('/notifications'),
          ),
          const SizedBox(height: AppSpacing.sm),

          // 9th Grade Welcome Banner
          if (student?.gradeLevel == 'NINTH') ...[
            AppCard(
              backgroundColor: AppColors.lightBlue,
              border: Border.all(
                color: AppColors.primaryBlue.withValues(alpha: 0.3),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: AppColors.primaryBlue.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.auto_stories_rounded,
                      color: AppColors.primaryBlue,
                      size: 26,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'محتوى الصف التاسع قيد الإضافة 📚',
                          style: AppTypography.cardTitle.copyWith(
                            fontWeight: FontWeight.bold,
                            color: AppColors.darkText,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'سيتم توفير المواد الدراسية وبنك الأسئلة والنماذج قريبًا.',
                          style: AppTypography.caption.copyWith(
                            color: AppColors.secondaryText,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],

          // 2. Day Plan (خطة اليوم)
          AppCard(
            backgroundColor: AppColors.surface,
            child: Row(
              children: [
                SizedBox(
                  width: 54,
                  height: 54,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      CircularProgressIndicator(
                        value: planProgress,
                        strokeWidth: 5,
                        backgroundColor: AppColors.border,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          AppColors.primaryBlue,
                        ),
                      ),
                      Text(
                        '${(planProgress * 100).round()}%',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                          fontFamily: 'Cairo',
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              "خطة اليوم الدراسية",
                              style: AppTypography.cardTitle.copyWith(
                                fontWeight: FontWeight.bold,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.lightGold,
                              borderRadius: BorderRadius.circular(
                                AppRadius.pill,
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.local_fire_department_rounded,
                                  color: AppColors.goldAccent,
                                  size: 13,
                                ),
                                const SizedBox(width: 2),
                                Text(
                                  "${streak ?? 0} أيام",
                                  style: AppTypography.caption.copyWith(
                                    color: AppColors.warmOrange,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 10,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        tasks.isEmpty
                            ? 'لا توجد مهام يومية متاحة'
                            : 'إنجاز $completedTasks من أصل ${tasks.length} مهام اليوم',
                        style: AppTypography.caption,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),

          // 3. Motivation Banner
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
                        "أنت على الطريق الصحيح!",
                        style: AppTypography.sectionTitle.copyWith(
                          color: AppColors.primaryBlue,
                          fontSize: 15,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        "استمر في تقديم أفضل ما لديك. اختبر معلوماتك وطور مستواك عبر المزيد من التحديات.",
                        style: AppTypography.caption.copyWith(
                          color: AppColors.darkText,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      ElevatedButton(
                        onPressed: () {
                          if (recommendedLesson == null) {
                            context.push('/quiz/setup');
                          } else {
                            context.push(
                              '/quiz/setup?subjectId=&unitId=&lessonId=',
                            );
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primaryBlue,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(AppRadius.pill),
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 6,
                          ),
                          elevation: 0,
                        ),
                        child: const Text(
                          'أكمل الآن 🚀',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 11,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.xs),
                const Icon(
                  Icons.stars_rounded,
                  color: AppColors.goldAccent,
                  size: 64,
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),

          // 4. Daily Challenge
          if (dailyTask != null) ...[
            AppCard(
              backgroundColor: AppColors.lightBlue,
              border: Border.all(
                color: AppColors.primaryBlue.withValues(alpha: 0.3),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.xs),
                    decoration: const BoxDecoration(
                      color: AppColors.primaryBlue,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.bolt_rounded,
                      color: Colors.white,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${dailyTask.title} (+${dailyTask.pointsReward} ن)',
                          style: AppTypography.cardTitle.copyWith(
                            fontWeight: FontWeight.bold,
                            color: AppColors.primaryBlue,
                            fontSize: 13,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          '${dailyTask.progress} / ${dailyTask.targetValue}',
                          style: AppTypography.caption.copyWith(fontSize: 10),
                        ),
                      ],
                    ),
                  ),
                  ElevatedButton(
                    onPressed: dailyTask.isCompleted && !dailyTask.rewardClaimed
                        ? () async {
                            await ref
                                .read(homeDashboardProvider.notifier)
                                .claimTask(dailyTask.id);
                          }
                        : null,
                    child: Text(
                      dailyTask.rewardClaimed
                          ? 'تم الاستلام'
                          : dailyTask.isCompleted
                          ? 'استلام'
                          : 'قيد التقدم',
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
          ],

          // 5. Overall Progress
          Text("تقدمك العام", style: AppTypography.sectionTitle),
          const SizedBox(height: AppSpacing.xs),
          Row(
            children: [
              Expanded(
                child: StatCard(
                  value: overview == null
                      ? '—'
                      : '${overview.masteryPercent.toStringAsFixed(0)}%',
                  label: "نسبة الإنجاز",
                  color: AppColors.primaryBlue,
                  icon: Icons.pie_chart_rounded,
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: StatCard(
                  value: points?.toString() ?? '—',
                  label: "النقاط",
                  color: AppColors.goldAccent,
                  icon: Icons.workspace_premium_rounded,
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: StatCard(
                  value: rank == null ? '—' : '#$rank',
                  label: "الترتيب",
                  color: AppColors.info,
                  icon: Icons.leaderboard_rounded,
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: StatCard(
                  value: level == null ? '—' : 'مستوى $level',
                  label: "الرتبة",
                  color: AppColors.successGreen,
                  icon: Icons.military_tech_rounded,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),

          // 6. Main Sections Grid (الأقسام الرئيسية)
          Text("الأقسام الرئيسية", style: AppTypography.sectionTitle),
          const SizedBox(height: AppSpacing.xs),
          GridView.count(
            crossAxisCount: 4,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 0.9,
            children: [
              _buildSectionItem(
                context: context,
                icon: Icons.import_contacts_rounded,
                label: "المواد والاختبارات",
                color: AppColors.primaryBlue,
                onTap: () => ref.read(tabIndexProvider.notifier).setIndex(1),
              ),

              _buildSectionItem(
                context: context,
                icon: Icons.assignment_rounded,
                label: "الاختبارات والنماذج",
                color: AppColors.secondaryTeal,
                onTap: () => context.push('/exam-models'),
              ),
              _buildSectionItem(
                context: context,
                icon: Icons.report_problem_rounded,
                label: "مراجعة الأخطاء",
                color: AppColors.errorCoral,
                onTap: () => context.push('/mistakes'),
              ),
              _buildSectionItem(
                context: context,
                icon: Icons.bookmark_rounded,
                label: "المحفوظات",
                color: AppColors.warmOrange,
                onTap: () => context.push('/saved'),
              ),
              _buildSectionItem(
                context: context,
                icon: Icons.sports_esports_rounded,
                label: "المنافسات",
                color: AppColors.info,
                onTap: () => ref.read(tabIndexProvider.notifier).setIndex(2),
              ),
              _buildSectionItem(
                context: context,
                icon: Icons.emoji_events_rounded,
                label: "الإنجازات",
                color: AppColors.goldAccent,
                onTap: () => context.push('/achievements'),
              ),
              _buildSectionItem(
                context: context,
                icon: Icons.menu_book_rounded,
                label: "المنهج الدراسي",
                color: AppColors.secondaryTeal,
                onTap: () => context.push('/curriculum-resources'),
              ),
              _buildSectionItem(
                context: context,
                icon: Icons.auto_awesome_rounded,
                label: 'المساعد الدراسي',
                color: AppColors.primaryBlue,
                onTap: () => context.push('/assistant'),
              ),
              _buildSectionItem(
                context: context,
                icon: Icons.fact_check_rounded,
                label: "المهام اليومية",
                color: Colors.purple,
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text("قائمة المهام اليومية متوفرة في خطتك!"),
                    ),
                  );
                },
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),

          // 7. Smart Recommendation (توصية ذكية)
          AppCard(
            backgroundColor: AppColors.surface,
            border: Border.all(
              color: AppColors.warning.withValues(alpha: 0.5),
              width: 1.5,
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.xs),
                  decoration: const BoxDecoration(
                    color: AppColors.lightGold,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.lightbulb_outline_rounded,
                    color: AppColors.warning,
                    size: 24,
                  ),
                ),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              "توصية ذكية لمراجعة الدرس",
                              style: AppTypography.cardTitle.copyWith(
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.lightError,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              "ضعف 45%",
                              style: AppTypography.caption.copyWith(
                                color: AppColors.errorCoral,
                                fontWeight: FontWeight.bold,
                                fontSize: 9,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        "الدرس: الحركة الموجية • الفيزياء",
                        style: AppTypography.caption.copyWith(
                          color: AppColors.darkText,
                          fontWeight: FontWeight.bold,
                          fontSize: 11,
                        ),
                      ),
                      Text(
                        "تم اقتراح 10 أسئلة مخصصة لسد الفجوة في هذا الدرس.",
                        style: AppTypography.caption.copyWith(fontSize: 10),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xxl),
        ],
      ),
    );
  }

  Widget _buildSectionItem({
    required BuildContext context,
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: AppTypography.caption.copyWith(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              color: AppColors.darkText,
            ),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
