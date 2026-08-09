import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:confetti/confetti.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/models/achievement_model.dart';
import '../../../core/utils/achievement_asset_resolver.dart';
import '../../../core/models/companion_enums.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_chip.dart';
import '../../../core/widgets/character_companion.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/repositories/providers.dart';

final achievementsListProvider = FutureProvider<List<AchievementModel>>((ref) {
  return ref.read(achievementsRepositoryProvider).getAchievements();
});

class AchievementsScreen extends ConsumerStatefulWidget {
  const AchievementsScreen({super.key});

  @override
  ConsumerState<AchievementsScreen> createState() => _AchievementsScreenState();
}

class _AchievementsScreenState extends ConsumerState<AchievementsScreen> {
  late ConfettiController _confettiController;
  String _activeTab = "all"; // 'all', 'earned', 'unearned', 'rare', 'daily'
  AchievementModel? _selectedAchievementForCelebration;

  @override
  void initState() {
    super.initState();
    _confettiController = ConfettiController(
      duration: const Duration(seconds: 3),
    );
  }

  @override
  void dispose() {
    _confettiController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final achievementsAsync = ref.watch(achievementsListProvider);

    return AppScaffold(
      appBar: AppBar(
        title: const Text("إنجازاتي وأوسمتي 🏆"),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: Stack(
        alignment: Alignment.center,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: AppSpacing.sm),
              Text("لوحة أوسمة التفوق والتميز", style: AppTypography.pageTitle),
              const SizedBox(height: AppSpacing.xs),
              Text(
                "حقق أهدافك اليومية واحل الاختبارات لتفتح الأوسمة النادرة وتجمع النقاط!",
                style: AppTypography.body,
              ),
              const SizedBox(height: AppSpacing.md),

              // --- 5 TABS (الكل، المكتسبة، غير المكتسبة، النادرة، اليومية) ---
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                child: Row(
                  children: [
                    AppChip(
                      label: "الكل",
                      isSelected: _activeTab == "all",
                      onSelected: (_) => setState(() => _activeTab = "all"),
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    AppChip(
                      label: "المكتسبة 🎉",
                      isSelected: _activeTab == "earned",
                      onSelected: (_) => setState(() => _activeTab = "earned"),
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    AppChip(
                      label: "غير المكتسبة 🔒",
                      isSelected: _activeTab == "unearned",
                      onSelected: (_) =>
                          setState(() => _activeTab = "unearned"),
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    AppChip(
                      label: "النادرة 💎",
                      isSelected: _activeTab == "rare",
                      onSelected: (_) => setState(() => _activeTab = "rare"),
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    AppChip(
                      label: "اليومية ⚡",
                      isSelected: _activeTab == "daily",
                      onSelected: (_) => setState(() => _activeTab = "daily"),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),

              // --- GRID OF ACHIEVEMENTS ---
              Expanded(
                child: achievementsAsync.when(
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (err, _) => Center(child: Text("خطأ: $err")),
                  data: (list) {
                    final filtered = _filterAchievements(list);
                    if (filtered.isEmpty) {
                      return const EmptyState(
                        title: "لا توجد أوسمة بهذه الفئة",
                        message: "واصل حل الاختبارات لتفتح هذا القسم قريباً!",
                        emotion: CharacterEmotion.waiting,
                      );
                    }
                    return GridView.builder(
                      physics: const BouncingScrollPhysics(),
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        crossAxisSpacing: AppSpacing.md,
                        mainAxisSpacing: AppSpacing.md,
                        childAspectRatio: MediaQuery.sizeOf(context).width < 360
                            ? 0.75
                            : 0.85,
                      ),
                      itemCount: filtered.length,
                      itemBuilder: (context, index) {
                        final achievement = filtered[index];
                        return _buildAchievementCard(achievement);
                      },
                    );
                  },
                ),
              ),
            ],
          ),

          // Confetti Celebratory Effect
          ConfettiWidget(
            confettiController: _confettiController,
            blastDirectionality: BlastDirectionality.explosive,
            shouldLoop: false,
            colors: const [
              AppColors.primaryBlue,
              AppColors.secondaryTeal,
              AppColors.goldAccent,
              AppColors.warmOrange,
              Colors.purple,
            ],
          ),

          // Character Celebration Overlay
          if (_selectedAchievementForCelebration != null)
            CharacterReactionOverlay(
              emotion: CharacterEmotion.achievement,
              title:
                  "وسام فتح جديد: ${_selectedAchievementForCelebration!.title} 🎉",
              subtitle: _selectedAchievementForCelebration!.description,
              onClose: () {
                setState(() {
                  _selectedAchievementForCelebration = null;
                });
              },
            ),
        ],
      ),
    );
  }

  List<AchievementModel> _filterAchievements(List<AchievementModel> list) {
    switch (_activeTab) {
      case "earned":
        return list.where((a) => a.isUnlocked).toList();
      case "unearned":
        return list.where((a) => !a.isUnlocked).toList();
      case "rare":
        return list
            .where(
              (a) => a.title.contains("أسطوري") || a.title.contains("خبير"),
            )
            .toList();
      case "daily":
        return list
            .where((a) => a.title.contains("يومي") || a.title.contains("سلسلة"))
            .toList();
      case "all":
      default:
        return list;
    }
  }

  Widget _buildAchievementCard(AchievementModel ach) {
    return AppCard(
      onTap: () {
        if (ach.isUnlocked) {
          _confettiController.stop();
          _confettiController.play();
          setState(() {
            _selectedAchievementForCelebration = ach;
          });
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                "هذا الوسام مغلق 🔒. متطلب الفتح: ${ach.description}",
              ),
              backgroundColor: AppColors.primaryBlue,
            ),
          );
        }
      },
      backgroundColor: ach.isUnlocked
          ? Colors.white
          : AppColors.border.withValues(alpha: 0.15),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  color: ach.isUnlocked
                      ? AppColors.lightGold
                      : AppColors.border.withValues(alpha: 0.3),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  AchievementAssetResolver.iconFor(ach.badgeIcon),
                  color: ach.isUnlocked
                      ? AppColors.goldAccent
                      : AppColors.mutedText,
                  size: 32,
                ),
              ),
              if (!ach.isUnlocked)
                const Positioned(
                  bottom: 0,
                  right: 0,
                  child: CircleAvatar(
                    radius: 10,
                    backgroundColor: AppColors.secondaryText,
                    child: Icon(Icons.lock, size: 10, color: Colors.white),
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),

          Text(
            ach.title,
            style: AppTypography.cardTitle.copyWith(
              fontWeight: FontWeight.bold,
              fontSize: 13,
              color: ach.isUnlocked ? AppColors.darkText : AppColors.mutedText,
            ),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),

          Text(
            ach.description,
            style: AppTypography.caption.copyWith(fontSize: 9),
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: AppSpacing.xs),

          Text(
            "التقدم: ${(ach.progress * 100).toInt()}%",
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              color: ach.isUnlocked
                  ? AppColors.primaryBlue
                  : AppColors.mutedText,
              fontFamily: 'Cairo',
            ),
          ),
        ],
      ),
    );
  }
}
