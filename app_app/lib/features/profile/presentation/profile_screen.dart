import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/repositories/providers.dart';
import '../../auth/providers/auth_provider.dart';
import '../../home/providers/home_dashboard_provider.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final student = ref.watch(authProvider);
    final dashboard = ref.watch(homeDashboardProvider);
    final overview = dashboard.overview.value;
    final pointsProfile = dashboard.points.value;
    final name = student?.name ?? 'الطالب';
    final phone = student?.phone.isNotEmpty == true ? student!.phone : '—';
    final points = pointsProfile?.currentPoints ?? overview?.totalPoints;
    final level = pointsProfile?.currentLevel ?? overview?.level;
    final streak = overview?.currentStreakDays;
    final gradeStr = student?.schoolName.isNotEmpty == true
        ? student!.schoolName
        : '—';

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: AppSpacing.sm),
          Text("الملف الشخصي والحساب", style: AppTypography.pageTitle),
          const SizedBox(height: AppSpacing.md),

          // 1. User Info Header Card
          AppCard(
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      width: 72,
                      height: 72,
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(AppRadius.md),
                        border: Border.all(
                          color: AppColors.primaryBlue,
                          width: 2,
                        ),
                        boxShadow: const [AppShadows.soft],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(AppRadius.md - 4),
                        child: const Icon(Icons.person, color: AppColors.primaryBlue, size: 40),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: AppTypography.cardTitle.copyWith(
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(gradeStr, style: AppTypography.caption),
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.lightBlue,
                              borderRadius: BorderRadius.circular(
                                AppRadius.pill,
                              ),
                            ),
                            child: Text(
                              "هاتف: $phone",
                              style: AppTypography.caption.copyWith(
                                color: AppColors.primaryBlue,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),

          // 2. Performance & Academic Stats
          Text("إحصائياتك الأكاديمية", style: AppTypography.sectionTitle),
          const SizedBox(height: AppSpacing.xs),
          Row(
            children: [
              Expanded(
                child: _buildSmallStat(
                  "النقاط",
                  points?.toString() ?? '—',
                  Icons.stars_rounded,
                  AppColors.goldAccent,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildSmallStat(
                  "المستوى",
                  level?.toString() ?? '—',
                  Icons.shield_rounded,
                  AppColors.primaryBlue,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildSmallStat(
                  "أيام التتابع",
                  streak == null ? '—' : '$streak أيام',
                  Icons.local_fire_department_rounded,
                  AppColors.warmOrange,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),

          // 3. Settings & Quick Links
          Text("الإعدادات والتفضيلات", style: AppTypography.sectionTitle),
          const SizedBox(height: AppSpacing.xs),
          AppCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                _buildSettingsTile(
                  context: context,
                  icon: Icons.edit_note_rounded,
                  title: "تعديل البيانات الشخصية",
                  subtitle: "الاسم، المسار (علمي/أدبي)",
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text("يمكنك تعديل بياناتك من خيار الحساب"),
                      ),
                    );
                  },
                ),
                const Divider(height: 1),
                _buildSettingsTile(
                  context: context,
                  icon: Icons.notifications_none_rounded,
                  title: "التنبيهات والذكرى اليومية",
                  subtitle: "مواعيد الاختبارات والتذكيرات",
                  onTap: () async {
                    final enable = await showDialog<bool>(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: const Text('تفعيل الإشعارات'),
                        content: const Text(
                          'اسمح بالتنبيهات لتصلك دعوات التحديات والتذكيرات والإنجازات المهمة.',
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(context, false),
                            child: const Text('ليس الآن'),
                          ),
                          FilledButton(
                            onPressed: () => Navigator.pop(context, true),
                            child: const Text('متابعة'),
                          ),
                        ],
                      ),
                    );
                    if (enable == true) {
                      await ref
                          .read(fcmNotificationServiceProvider)
                          .start(requestPermission: true);
                    }
                    if (context.mounted) context.push('/notifications');
                  },
                ),
                const Divider(height: 1),
                _buildSettingsTile(
                  context: context,
                  icon: Icons.dark_mode_outlined,
                  title: "المظهر (الوضع الداكن)",
                  subtitle: "تفعيل المظهر الليلي",
                  onTap: () {},
                ),
                const Divider(height: 1),
                _buildSettingsTile(
                  context: context,
                  icon: Icons.help_outline_rounded,
                  title: "المساعدة والتعليمات",
                  subtitle: "عن بنك الأسئلة اليمني",
                  onTap: () {},
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),

          // 4. Logout Button
          OutlineButton(
            width: double.infinity,
            text: "تسجيل الخروج من الحساب 🚪",
            onPressed: () {
              ref.read(authProvider.notifier).logout();
              context.go('/login');
            },
          ),
          const SizedBox(height: AppSpacing.xxl),
        ],
      ),
    );
  }

  Widget _buildSmallStat(
    String label,
    String value,
    IconData icon,
    Color color,
  ) {
    return AppCard(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      child: Column(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 4),
          Text(
            value,
            style: AppTypography.cardTitle.copyWith(
              fontWeight: FontWeight.bold,
              fontSize: 15,
            ),
          ),
          Text(label, style: AppTypography.caption.copyWith(fontSize: 10)),
        ],
      ),
    );
  }

  Widget _buildSettingsTile({
    required BuildContext context,
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: ListTile(
        onTap: onTap,
        leading: Icon(icon, color: AppColors.primaryBlue),
        title: Text(title, style: AppTypography.cardTitle.copyWith(fontSize: 14)),
        subtitle: Text(subtitle, style: AppTypography.caption),
        trailing: const Icon(
          Icons.arrow_forward_ios_rounded,
          size: 14,
          color: AppColors.secondaryText,
        ),
      ),
    );
  }
}
