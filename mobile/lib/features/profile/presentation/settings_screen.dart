import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/models/companion_enums.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../auth/providers/auth_provider.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final student = ref.watch(authProvider);
    final companion = student?.selectedCompanionType ?? CompanionType.male;

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
            const SizedBox(height: AppSpacing.sm),

            // --- SECTION 1: CHARACTER & GENDER ---
            Text("الشخصية التفاعلية والجنس", style: AppTypography.sectionTitle),
            const SizedBox(height: AppSpacing.xs),
            AppCard(
              onTap: () => context.push('/character-customization'),
              child: Row(
                children: [
                  const Icon(
                    Icons.face_5_rounded,
                    color: AppColors.primaryBlue,
                    size: 24,
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "تخصيص شخصية الطالب والرسوم",
                          style: AppTypography.cardTitle.copyWith(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                        Text(
                          "الشخصية الحالية: ${companion == CompanionType.male ? 'طالب (أحمد 👦)' : 'طالبة (أمل 👧)'}",
                          style: AppTypography.caption,
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_left, color: AppColors.border),
                ],
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
                  ListTile(
                    title: Text(
                      "مستوى تأثيرات الحركة (Animations)",
                      style: AppTypography.cardTitle.copyWith(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                    subtitle: const Text(
                      "التحكم بحركات ودخول الشخصيات والبطاقات.",
                    ),
                    trailing: DropdownButton<String>(
                      value: _getMotionLevelString(
                        student?.motionLevel ?? MotionLevel.full,
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: 'full',
                          child: Text("حركة كاملة"),
                        ),
                        DropdownMenuItem(
                          value: 'reduced',
                          child: Text("حركة خفيفة"),
                        ),
                        DropdownMenuItem(
                          value: 'disabled',
                          child: Text("إيقاف الحركة"),
                        ),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          ref
                              .read(authProvider.notifier)
                              .updateMotionLevel(_getMotionLevelEnum(val));
                        }
                      },
                    ),
                  ),
                  const Divider(height: 1),
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

  String _getMotionLevelString(MotionLevel level) {
    switch (level) {
      case MotionLevel.full:
        return 'full';
      case MotionLevel.reduced:
        return 'reduced';
      case MotionLevel.disabled:
        return 'disabled';
    }
  }

  MotionLevel _getMotionLevelEnum(String levelStr) {
    switch (levelStr) {
      case 'full':
        return MotionLevel.full;
      case 'reduced':
        return MotionLevel.reduced;
      case 'disabled':
      default:
        return MotionLevel.disabled;
    }
  }
}
