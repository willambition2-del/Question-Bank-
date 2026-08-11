import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/models/leaderboard_entry.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/repositories/providers.dart';

// Family provider for leaderboard filtering
final leaderboardEntriesProvider =
    FutureProvider.family<
      List<LeaderboardEntry>,
      ({String timeFilter, String typeFilter})
    >((ref, arg) {
      return ref
          .read(leaderboardRepositoryProvider)
          .getLeaderboard(arg.timeFilter, arg.typeFilter);
    });

class LeaderboardScreen extends ConsumerStatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  ConsumerState<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends ConsumerState<LeaderboardScreen> {
  String _timeFilter = "week"; // 'day', 'week', 'month', 'all'
  String _typeFilter = "general"; // 'general', 'subject', 'friends', 'school'

  @override
  Widget build(BuildContext context) {
    final entriesAsync = ref.watch(
      leaderboardEntriesProvider((
        timeFilter: _timeFilter,
        typeFilter: _typeFilter,
      )),
    );

    return AppScaffold(
      appBar: AppBar(
        title: const Text("لوحة المتصدرين"),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: Column(
        children: [
          // --- TIME FILTER CHIPS ---
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: [
                _buildTimeChip("اليوم", "day"),
                const SizedBox(width: AppSpacing.xs),
                _buildTimeChip("الأسبوع", "week"),
                const SizedBox(width: AppSpacing.xs),
                _buildTimeChip("الشهر", "month"),
                const SizedBox(width: AppSpacing.xs),
                _buildTimeChip("كل الوقت", "all"),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),

          // --- TYPE FILTER TABS ---
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: [
                _buildTypeChip("الترتيب العام", "general"),
                const SizedBox(width: AppSpacing.xs),
                _buildTypeChip("المدرسة", "school"),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),

          // --- LEADERBOARD DATA ---
          Expanded(
            child: entriesAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, _) => Center(child: Text("خطأ: $err")),
              data: (entries) {
                if (entries.isEmpty) {
                  return const Center(
                    child: Text("لا توجد بيانات صدارة متاحة حالياً."),
                  );
                }

                // Separate top 3 and others
                final topThree = entries.where((e) => e.rank <= 3).toList();
                topThree.sort(
                  (a, b) => a.rank.compareTo(b.rank),
                ); // 1st, 2nd, 3rd

                final others = entries.where((e) => e.rank > 3).toList();
                others.sort((a, b) => a.rank.compareTo(b.rank));

                return Column(
                  children: [
                    // Podium for top 3
                    if (topThree.isNotEmpty) ...[
                      _buildPodium(topThree),
                      const SizedBox(height: AppSpacing.lg),
                    ],

                    // List of others
                    Expanded(
                      child: ListView.builder(
                        itemCount: others.length,
                        physics: const BouncingScrollPhysics(),
                        itemBuilder: (context, index) {
                          final entry = others[index];
                          return _buildLeaderboardRow(entry);
                        },
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTimeChip(String text, String value) {
    final isActive = _timeFilter == value;
    return ChoiceChip(
      label: Text(
        text,
        style: AppTypography.caption.copyWith(
          color: isActive ? Colors.white : AppColors.secondaryText,
          fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
        ),
      ),
      selected: isActive,
      onSelected: (selected) {
        if (selected) {
          setState(() {
            _timeFilter = value;
          });
        }
      },
      selectedColor: AppColors.primaryBlue,
      backgroundColor: AppColors.cardBackground,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.pill),
        side: BorderSide(
          color: isActive ? Colors.transparent : AppColors.border,
        ),
      ),
    );
  }

  Widget _buildTypeChip(String text, String value) {
    final isActive = _typeFilter == value;
    return ChoiceChip(
      label: Text(
        text,
        style: AppTypography.caption.copyWith(
          color: isActive ? Colors.white : AppColors.secondaryText,
          fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
        ),
      ),
      selected: isActive,
      onSelected: (selected) {
        if (selected) {
          setState(() {
            _typeFilter = value;
          });
        }
      },
      selectedColor: AppColors.secondaryTeal,
      backgroundColor: AppColors.cardBackground,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.pill),
        side: BorderSide(
          color: isActive ? Colors.transparent : AppColors.border,
        ),
      ),
    );
  }

  Widget _buildPodium(List<LeaderboardEntry> topThree) {
    // Reorder for visual rendering: 2nd on right, 1st in center, 3rd on left
    LeaderboardEntry? first = topThree.firstWhere((e) => e.rank == 1);
    LeaderboardEntry? second = topThree.firstWhere((e) => e.rank == 2);
    LeaderboardEntry? third = topThree.firstWhere((e) => e.rank == 3);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
        boxShadow: const [AppShadows.soft],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          // 3rd place (Bronze)
          Expanded(
            child: _buildPodiumCol(
              entry: third,
              height: 100,
              medalColor: const Color(0xFFCD7F32), // Bronze
              textColor: const Color(0xFF8C531D),
              bgColor: const Color(0xFFFAF0E6),
            ),
          ),

          // 1st place (Gold)
          Expanded(
            child: _buildPodiumCol(
              entry: first,
              height: 140,
              medalColor: AppColors.goldAccent, // Gold
              textColor: AppColors.warmOrange,
              bgColor: AppColors.lightGold,
              isCenter: true,
            ),
          ),

          // 2nd place (Silver)
          Expanded(
            child: _buildPodiumCol(
              entry: second,
              height: 115,
              medalColor: const Color(0xFFC0C0C0), // Silver
              textColor: const Color(0xFF696969),
              bgColor: const Color(0xFFF5F5F5),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPodiumCol({
    required LeaderboardEntry? entry,
    required double height,
    required Color medalColor,
    required Color textColor,
    required Color bgColor,
    bool isCenter = false,
  }) {
    if (entry == null) return const SizedBox.shrink();

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Avatar representation (Boy thobe / Girl Hijab colors)
        Container(
          width: isCenter ? 64 : 52,
          height: isCenter ? 64 : 52,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: medalColor, width: 3),
            color: bgColor,
          ),
          child: const Center(
            child: Icon(Icons.person, color: AppColors.secondaryText, size: 28),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          entry.name.split(' ').first,
          style: AppTypography.cardTitle.copyWith(
            fontWeight: FontWeight.bold,
            fontSize: isCenter ? 14 : 12,
          ),
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        Text(
          "${entry.points}ن",
          style: AppTypography.caption.copyWith(
            color: textColor,
            fontWeight: FontWeight.bold,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.xs),

        // Podium Column Pillar
        Container(
          height: height,
          width: double.infinity,
          margin: const EdgeInsets.symmetric(horizontal: 4),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                medalColor.withValues(alpha: 0.8),
                medalColor.withValues(alpha: 0.3),
              ],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(AppRadius.sm),
              topRight: Radius.circular(AppRadius.sm),
            ),
          ),
          child: Center(
            child: Text(
              "#${entry.rank}",
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: isCenter ? 24 : 18,
                shadows: const [
                  Shadow(
                    offset: Offset(0, 1),
                    blurRadius: 2,
                    color: Colors.black38,
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLeaderboardRow(LeaderboardEntry entry) {
    // Determine rank change indicator
    Widget changeWidget = const SizedBox.shrink();
    if (entry.rankChange > 0) {
      changeWidget = Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.arrow_upward,
            color: AppColors.successGreen,
            size: 12,
          ),
          Text(
            "${entry.rankChange}",
            style: const TextStyle(
              color: AppColors.successGreen,
              fontSize: 10,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      );
    } else if (entry.rankChange < 0) {
      changeWidget = Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.arrow_downward,
            color: AppColors.errorCoral,
            size: 12,
          ),
          Text(
            "${entry.rankChange.abs()}",
            style: const TextStyle(
              color: AppColors.errorCoral,
              fontSize: 10,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      );
    } else {
      changeWidget = const Text(
        "-",
        style: TextStyle(color: AppColors.mutedText, fontSize: 12),
      );
    }

    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: 10,
      ),
      child: Row(
        children: [
          // Rank index
          SizedBox(
            width: 24,
            child: Text(
              "${entry.rank}",
              style: AppTypography.cardTitle.copyWith(
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),

          // Avatar indicator
          Container(
            width: 36,
            height: 36,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.background,
            ),
            child: const Icon(
              Icons.person_outline,
              size: 20,
              color: AppColors.secondaryText,
            ),
          ),
          const SizedBox(width: AppSpacing.md),

          // User details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.name,
                  style: AppTypography.cardTitle.copyWith(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  entry.schoolName,
                  style: AppTypography.caption.copyWith(fontSize: 10),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),

          // Points and Rank Change
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                "${entry.points}ن",
                style: AppTypography.caption.copyWith(
                  fontWeight: FontWeight.bold,
                  color: AppColors.primaryBlue,
                ),
              ),
              const SizedBox(height: 2),
              changeWidget,
            ],
          ),
        ],
      ),
    );
  }
}
