import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../auth/providers/auth_provider.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final student = ref.watch(authProvider);
    return AppScaffold(
      appBar: AppBar(
        title: const Text("الإعدادات العامة للتطبيق"),
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
            // --- SECTION 1: CHALLENGES ---
            Text(
              "المنافسات واللعب الجماعي",
              style: AppTypography.sectionTitle,
            ),
            const SizedBox(height: AppSpacing.xs),
            AppCard(
              padding: EdgeInsets.zero,
              child: ListTile(
                leading: const Icon(
                  Icons.emoji_events_rounded,
                  color: AppColors.goldAccent,
                ),
                title: Text(
                  "ساحة المنافسة",
                  style: AppTypography.cardTitle.copyWith(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                subtitle: const Text("العب وتنافس مع زملائك."),
                trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 16),
                onTap: () => context.push('/challenges'),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),

            // --- SECTION 2: QUIZ & TIMER SETTINGS ---
            Text(
              "إعدادات الاختبارات والمؤشر",
              style: AppTypography.sectionTitle,
            ),
            const SizedBox(height: AppSpacing.xs),
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [

                  SwitchListTile(
                    title: Text(
                      "المؤثرات الصوتية للاختبارات",
                      style: AppTypography.cardTitle.copyWith(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                    subtitle: const Text(
                      "أصوات التنبيه والإجابة الصحيحة أو الخاطئة.",
                    ),
                    value: student?.soundsEnabled ?? true,
                    onChanged: (val) {
                      ref.read(authProvider.notifier).updateSoundsEnabled(val);
                    },
                    activeThumbColor: AppColors.primaryBlue,
                  ),
                  const Divider(height: 1),
                  SwitchListTile(
                    title: Text(
                      "الاهتزاز والتغذية الراجعة (Haptic)",
                      style: AppTypography.cardTitle.copyWith(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                    subtitle: const Text("اهتزاز الخيارات وتأكيدات الإجابة."),
                    value: student?.hapticsEnabled ?? true,
                    onChanged: (val) {
                      ref.read(authProvider.notifier).updateHapticsEnabled(val);
                    },
                    activeThumbColor: AppColors.primaryBlue,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),

            // --- SECTION 3: SYSTEM & PRIVACY ---
            Text("النظام واللغة والخصوصية", style: AppTypography.sectionTitle),
            const SizedBox(height: AppSpacing.xs),
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(
                      Icons.language_rounded,
                      color: AppColors.primaryBlue,
                    ),
                    title: Text(
                      "لغة التطبيق",
                      style: AppTypography.cardTitle.copyWith(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                    subtitle: const Text("العربية (الجمهورية اليمنية) • RTL"),
                    trailing: const Icon(
                      Icons.check_circle,
                      color: AppColors.successGreen,
                      size: 20,
                    ),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(
                      Icons.security_rounded,
                      color: AppColors.primaryBlue,
                    ),
                    title: Text(
                      "سياسة الخصوصية وأمان البيانات",
                      style: AppTypography.cardTitle.copyWith(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                    subtitle: const Text("تشفير نتائج الطلاب والتقدم الشخصي."),
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            "بياناتك محمية ومحفوظة محلياً وفي الخادم المشفر.",
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xxl),
          ],
        ),
      ),
    );
  }

}
