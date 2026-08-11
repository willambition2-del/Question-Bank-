import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/network/challenge_api_models.dart';
import '../providers/challenge_provider.dart';
import '../providers/team_challenge_provider.dart';
import '../../auth/providers/auth_provider.dart';

class ChallengeWaitingScreen extends ConsumerStatefulWidget {
  final String mode; // 'oneVsOne' or 'twoVsTwo'
  final String? subjectId;
  final String? challengeId;

  const ChallengeWaitingScreen({
    super.key,
    required this.mode,
    this.subjectId,
    this.challengeId,
  });

  @override
  ConsumerState<ChallengeWaitingScreen> createState() =>
      _ChallengeWaitingScreenState();
}

class _ChallengeWaitingScreenState
    extends ConsumerState<ChallengeWaitingScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      final challengeMode = widget.mode == 'twoVsTwo'
          ? ChallengeMode.twoVsTwo
          : ChallengeMode.oneVsOne;
      if (widget.challengeId != null) {
        ref.read(challengeProvider.notifier).joinExisting(widget.challengeId!);
      } else if (widget.mode == 'twoVsTwo') {
        ref
            .read(teamChallengeNotifierProvider.notifier)
            .setupTeamMatch(subjectId: widget.subjectId ?? '');
      } else {
        ref
            .read(challengeProvider.notifier)
            .searchOpponent(challengeMode, subjectId: widget.subjectId);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final isTeamMode = widget.mode == 'twoVsTwo';

    if (isTeamMode) {
      final teamState = ref.watch(teamChallengeNotifierProvider);
      return _buildTeamLobby(context, teamState);
    }

    final challengeState = ref.watch(challengeProvider);

    if (challengeState.status == 'active') {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.push('/challenges/live');
      });
    }
    return AppScaffold(
      appBar: AppBar(
        title: const Text("المواجهة"),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            ref.read(challengeProvider.notifier).exitMatch();
            context.pop();
          },
        ),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (challengeState.status == 'searching') ...[
              const Icon(
                Icons.search,
                size: 64,
                color: AppColors.primaryBlue,
              ),
              const SizedBox(height: AppSpacing.sm),
              const Text(
                "جاري البحث عن منافس...",
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primaryBlue,
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              const CircularProgressIndicator(color: AppColors.primaryBlue),
              const SizedBox(height: AppSpacing.lg),
              OutlineButton(
                width: 160,
                text: "إلغاء البحث",
                onPressed: () {
                  ref.read(challengeProvider.notifier).exitMatch();
                  context.pop();
                },
              ),
            ] else if (challengeState.status == 'countdown') ...[
              const Icon(
                Icons.emoji_events,
                size: 64,
                color: AppColors.goldAccent,
              ),
              const SizedBox(height: AppSpacing.sm),
              const Text(
                "استعد للمواجهة!",
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.goldAccent,
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              AppCard(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _buildPlayerSlot(
                      "أنت",
                      "المستوى 12",
                      AppColors.primaryBlue,
                      "جاهز",
                    ),
                    Text(
                      "${challengeState.countdownSeconds}",
                      style: AppTypography.displayLarge.copyWith(
                        fontSize: 48,
                        color: AppColors.goldAccent,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    _buildPlayerSlot(
                      challengeState.opponent?.name ?? "منافس",
                      "المستوى 11",
                      AppColors.goldAccent,
                      "جاهز",
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              PrimaryButton(
                width: 200,
                text: "دخول الساحة ⚔️",
                onPressed: () => context.push('/challenges/live'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildTeamLobby(
    BuildContext context,
    TeamChallengeState teamState,
  ) {
    return AppScaffold(
      appBar: AppBar(
        title: Text("غرفة الانتظار 2v2 (${teamState.roomCode})"),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: Column(
        children: [
          const SizedBox(height: AppSpacing.sm),
          AppCard(
            backgroundColor: AppColors.lightBlue,
            child: Row(
              children: [
                const Icon(
                  Icons.qr_code_rounded,
                  color: AppColors.primaryBlue,
                  size: 28,
                ),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "كود الغرفة: ${teamState.roomCode}",
                        style: AppTypography.cardTitle.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const Text(
                        "شارك الكود مع أصدقائك للانضمام للفريقين",
                        style: TextStyle(fontSize: 11),
                      ),
                    ],
                  ),
                ),
                ElevatedButton(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          "تم نسخ كود الغرفة ${teamState.roomCode}",
                        ),
                      ),
                    );
                  },
                  child: const Text("نسخ الكود"),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),

          // BLUE TEAM & GOLD TEAM 4 PLAYERS
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: AppCard(
                  child: Column(
                    children: [
                      Text(
                        "الفريق الأزرق 🟦",
                        style: AppTypography.cardTitle.copyWith(
                          color: AppColors.primaryBlue,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      ...teamState.blueTeam.map(
                        (p) => _buildPlayerStatusTile(p),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: AppCard(
                  child: Column(
                    children: [
                      Text(
                        "الفريق الذهبي 🟨",
                        style: AppTypography.cardTitle.copyWith(
                          color: AppColors.goldAccent,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      ...teamState.goldTeam.map(
                        (p) => _buildPlayerStatusTile(p),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const Spacer(),

          PrimaryButton(
            width: double.infinity,
            text: "تغيير حالة الاستعداد (جاهز)",
            onPressed: () {
              ref
                  .read(teamChallengeNotifierProvider.notifier)
                  .togglePlayerReady();
            },
          ),
          const SizedBox(height: AppSpacing.sm),
          OutlineButton(
            width: double.infinity,
            text: "مغادرة الغرفة",
            onPressed: () => context.pop(),
          ),
          const SizedBox(height: AppSpacing.lg),
        ],
      ),
    );
  }

  Widget _buildPlayerSlot(
    String name,
    String level,
    Color color,
    String status,
  ) {
    return Column(
      children: [
        Container(
          width: 60,
          height: 60,
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(color: color, width: 2.0),
            boxShadow: const [AppShadows.soft],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.md - 3),
            child: Icon(Icons.person, color: color, size: 40),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          name,
          style: AppTypography.cardTitle.copyWith(
            fontSize: 13,
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(level, style: AppTypography.caption),
        const SizedBox(height: 2),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
            color: AppColors.lightTeal,
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            status,
            style: AppTypography.caption.copyWith(
              color: AppColors.successGreen,
              fontSize: 9,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPlayerStatusTile(TeamPlayer p) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.xs),
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(AppRadius.sm),
      ),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            padding: const EdgeInsets.all(2),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(AppRadius.sm),
              border: Border.all(color: AppColors.border, width: 1),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.sm - 2),
              child: const Icon(Icons.person, color: AppColors.primaryBlue, size: 20),
            ),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  p.name,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  p.status == 'ready' ? 'جاهز ✅' : 'ينتظر...',
                  style: TextStyle(
                    fontSize: 9,
                    color: p.status == 'ready'
                        ? AppColors.successGreen
                        : AppColors.secondaryText,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
