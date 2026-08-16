import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'dart:ui';
import '../../../app/theme/design_tokens.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/network/challenge_api_models.dart';
import '../providers/challenge_provider.dart';

class ChallengesScreen extends ConsumerWidget {
  const ChallengesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activeChallenges = ref.watch(challengeActiveListProvider);
    final history = ref.watch(challengeHistoryProvider);
    ref.watch(challengeModesProvider);

    return AppScaffold(
      appBar: AppBar(
        title: const Text("ساحة المنافسات"),
      ),
      body: Stack(
        children: [
          Opacity(
            opacity: 0.6,
            child: ImageFiltered(
              imageFilter: ImageFilter.blur(sigmaX: 4, sigmaY: 4),
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
        const SizedBox(height: AppSpacing.sm),
        Text("ساحة المنافسات والتحديات", style: AppTypography.pageTitle),
        const SizedBox(height: AppSpacing.xs),
        Text(
          "تحدى أصدقاءك وطلاب المملكة في مواجهات مباشرة 1v1 أو 2v2 جماعية 🏆",
          style: AppTypography.body,
        ),
        const SizedBox(height: AppSpacing.md),

        Expanded(
          child: SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // --- 1V1 LIVE ARENA HERO CARD ---
                Container(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF2F5BEA), Color(0xFF173EA8)],
                      begin: Alignment.topRight,
                      end: Alignment.bottomLeft,
                    ),
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    boxShadow: const [AppShadows.card],
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: [
                          Flexible(
                            child: Column(
                              children: [
                                Container(
                                  height: 85,
                                  padding: const EdgeInsets.all(4),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(
                                      AppRadius.md,
                                    ),
                                    border: Border.all(
                                      color: Colors.white,
                                      width: 1.5,
                                    ),
                                    color: Colors.white,
                                  ),
                                  child: Icon(
                                    Icons.person,
                                    size: 60,
                                    color: AppColors.primaryBlue,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  "أنت (12)",
                                  style: AppTypography.caption.copyWith(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [
                                    AppColors.goldAccent,
                                    AppColors.warmOrange,
                                  ],
                                ),
                                borderRadius: BorderRadius.circular(
                                  AppRadius.pill,
                                ),
                              ),
                              child: const Text(
                                "VS",
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 16,
                                  fontStyle: FontStyle.italic,
                                ),
                              ),
                            ),
                          ),
                          Flexible(
                            child: Column(
                              children: [
                                Container(
                                  height: 85,
                                  padding: const EdgeInsets.all(4),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(
                                      AppRadius.md,
                                    ),
                                    border: Border.all(
                                      color: AppColors.goldAccent,
                                      width: 1.5,
                                    ),
                                    color: Colors.white,
                                  ),
                                  child: const Icon(
                                    Icons.person_outline,
                                    size: 60,
                                    color: AppColors.goldAccent,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'منافس عبر الإنترنت',
                                  style: AppTypography.caption.copyWith(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.md),
                      PrimaryButton(
                        width: double.infinity,
                        text: "ابدأ تحدي 1 ضد 1 المباشر ⚔️",
                        onPressed: () =>
                            context.push('/challenges/waiting?mode=oneVsOne'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),

                // --- 2V2 TEAM CHALLENGE CARD ---
                AppCard(
                  backgroundColor: AppColors.lightTeal,
                  border: Border.all(
                    color: AppColors.secondaryTeal.withValues(alpha: 0.3),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(
                            Icons.groups_rounded,
                            color: AppColors.secondaryTeal,
                            size: 28,
                          ),
                          const SizedBox(width: AppSpacing.xs),
                          Expanded(
                            child: Text(
                              "تحدي الفرق 2 ضد 2 (Team Challenge)",
                              style: AppTypography.cardTitle.copyWith(
                                fontWeight: FontWeight.bold,
                                color: AppColors.secondaryTeal,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        "شكّل فريقك مع صديق وتحدّ فريقاً آخر في منافسة جماعية مباشرة.",
                        style: AppTypography.caption,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Row(
                        children: [
                          Expanded(
                            child: SecondaryButton(
                              height: 42,
                              text: "إنشاء غرفة 2v2 👥",
                              onPressed: () => context.push(
                                '/challenges/waiting?mode=twoVsTwo',
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlineButton(
                              height: 42,
                              text: "انضمام بكود الغرفة",
                              onPressed: () =>
                                  _showJoinCodeDialog(context, ref),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),

                // --- MODES SELECTION GRID ---
                Text(
                  "أنواع التحديات والمنافسات",
                  style: AppTypography.sectionTitle,
                ),
                const SizedBox(height: AppSpacing.xs),
                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisSpacing: AppSpacing.sm,
                  mainAxisSpacing: AppSpacing.sm,
                  childAspectRatio: 1.5,
                  children: [
                    _buildChallengeModeCard(
                      "تحدي مباشر عشوائي",
                      "منافسة سريعة مع طالب أونلاين",
                      Icons.flash_on_rounded,
                      AppColors.primaryBlue,
                      () => context.push('/challenges/waiting?mode=oneVsOne'),
                    ),
                    _buildChallengeModeCard(
                      "تحدي صديق",
                      "دعوة صديق محدد للمنافسة",
                      Icons.person_add_rounded,
                      AppColors.goldAccent,
                      () => _showInviteFriendDialog(context, ref),
                    ),
                    _buildChallengeModeCard(
                      "سجل المنافسات",
                      "عرض نتائج مواجهاتك السابقة",
                      Icons.history_rounded,
                      AppColors.info,
                      () => _showHistoryDialog(context, history),
                    ),
                    _buildChallengeModeCard(
                      "ترتيب الأصدقاء",
                      "لوحة الأصدقاء الأكثر نقاطاً",
                      Icons.leaderboard_rounded,
                      AppColors.successGreen,
                      () => context.push('/leaderboard'),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),

                // --- PENDING INVITES & CHALLENGES ---
                Text('دعوات وتحديات معلقة', style: AppTypography.sectionTitle),
                const SizedBox(height: AppSpacing.xs),
                activeChallenges.when(
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (_, _) =>
                      const AppCard(child: Text('تعذر تحميل التحديات المعلقة')),
                  data: (page) => page.items.isEmpty
                      ? const AppCard(child: Text('لا توجد دعوات معلقة'))
                      : Column(
                          children: page.items
                              .map(
                                (challenge) => AppCard(
                                  child: ListTile(
                                    leading: const Icon(
                                      Icons.mail_outline_rounded,
                                      color: AppColors.warmOrange,
                                    ),
                                    title: Text(_modeLabel(challenge.mode)),
                                    subtitle: Text(
                                      '${challenge.questionCount} أسئلة',
                                    ),
                                    trailing: PrimaryButton(
                                      height: 34,
                                      width: 75,
                                      text: 'فتح',
                                      onPressed: () => context.push(
                                        '/challenges/waiting?mode=${challenge.mode == ChallengeMode.twoVsTwo ? 'twoVsTwo' : 'oneVsOne'}&challengeId=${challenge.id}',
                                      ),
                                    ),
                                  ),
                                ),
                              )
                              .toList(growable: false),
                        ),
                ),
                const SizedBox(height: AppSpacing.xxl),
              ],
            ),
          ),
        ), // end Expanded
                  ],
                ), // end Column
              ), // end Padding
            ), // end ImageFiltered
          ), // end Opacity
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
              margin: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: const [AppShadows.card],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.construction_rounded, size: 48, color: AppColors.primaryBlue),
                  const SizedBox(height: 16),
                  Text(
                    "قريباً!",
                    style: AppTypography.pageTitle.copyWith(color: AppColors.primaryBlue),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    "نعمل على تطوير ساحة المنافسات\nلتقديم تجربة لعب رائعة قريباً.",
                    textAlign: TextAlign.center,
                    style: AppTypography.body.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 24),
                  PrimaryButton(
                    text: "العودة للإعدادات",
                    onPressed: () => context.pop(),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChallengeModeCard(
    String title,
    String subtitle,
    IconData icon,
    Color color,
    VoidCallback onTap,
  ) {
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.all(AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 4),
          Text(
            title,
            style: AppTypography.cardTitle.copyWith(
              fontWeight: FontWeight.bold,
              fontSize: 13,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          Text(
            subtitle,
            style: AppTypography.caption.copyWith(fontSize: 10),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  void _showJoinCodeDialog(BuildContext context, WidgetRef ref) {
    final controller = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('الانضمام إلى غرفة 2 ضد 2'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            hintText: 'أدخل معرّف الغرفة UUID',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('إلغاء'),
          ),
          FilledButton(
            onPressed: () {
              final id = controller.text.trim();
              if (id.isEmpty) return;
              Navigator.pop(dialogContext);
              context.push('/challenges/waiting?mode=twoVsTwo&challengeId=$id');
            },
            child: const Text('انضمام'),
          ),
        ],
      ),
    ).whenComplete(controller.dispose);
  }

  void _showInviteFriendDialog(BuildContext context, WidgetRef ref) {
    final controller = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('دعوة صديق'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            hintText: 'أدخل معرّف المستخدم UUID',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('إلغاء'),
          ),
          FilledButton(
            onPressed: () async {
              final userId = controller.text.trim();
              if (userId.isEmpty) return;
              Navigator.pop(dialogContext);
              await ref
                  .read(challengeProvider.notifier)
                  .createFriendChallenge(userId);
              final id = ref.read(challengeProvider).challenge?.id;
              if (context.mounted && id != null) {
                context.push(
                  '/challenges/waiting?mode=oneVsOne&challengeId=$id',
                );
              }
            },
            child: const Text('إرسال الدعوة'),
          ),
        ],
      ),
    ).whenComplete(controller.dispose);
  }

  void _showHistoryDialog(
    BuildContext context,
    AsyncValue<ChallengePage> history,
  ) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('سجل المواجهات'),
        content: SizedBox(
          width: double.maxFinite,
          child: history.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (_, _) => const Text('تعذر تحميل سجل المواجهات'),
            data: (page) => page.items.isEmpty
                ? const Text('لا توجد مواجهات مكتملة')
                : ListView(
                    shrinkWrap: true,
                    children: page.items
                        .map(
                          (challenge) => ListTile(
                            title: Text(_modeLabel(challenge.mode)),
                            subtitle: Text('${challenge.questionCount} أسئلة'),
                            trailing: const Icon(
                              Icons.emoji_events_outlined,
                              color: AppColors.goldAccent,
                            ),
                          ),
                        )
                        .toList(growable: false),
                  ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('إغلاق'),
          ),
        ],
      ),
    );
  }

  String _modeLabel(ChallengeMode mode) => switch (mode) {
    ChallengeMode.oneVsOne => 'تحدي 1 ضد 1',
    ChallengeMode.twoVsTwo => 'تحدي 2 ضد 2',
    ChallengeMode.lightning => 'تحدي البرق',
    ChallengeMode.survival => 'تحدي البقاء',
  };
}
