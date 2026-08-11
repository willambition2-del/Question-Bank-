import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'challenge_provider.dart';

class TeamPlayer {
  final String id;
  final String name;
  final int level;
  final String status;
  final bool isMvp;
  const TeamPlayer({
    required this.id,
    required this.name,
    this.level = 0,
    required this.status,
    this.isMvp = false,
  });
}

class TeamChallengeState {
  final bool teamChallengeEnabled;
  final String status;
  final String roomCode;
  final List<TeamPlayer> blueTeam;
  final List<TeamPlayer> goldTeam;
  final int blueScore;
  final int goldScore;
  final String? errorMessage;
  const TeamChallengeState({
    this.teamChallengeEnabled = true,
    this.status = 'modeSelect',
    this.roomCode = '',
    this.blueTeam = const [],
    this.goldTeam = const [],
    this.blueScore = 0,
    this.goldScore = 0,
    this.errorMessage,
  });
}

class TeamChallengeNotifier extends Notifier<TeamChallengeState> {
  @override
  TeamChallengeState build() {
    ref.listen(
      challengeProvider,
      (_, next) => state = _map(next),
      fireImmediately: true,
    );
    return _map(ref.read(challengeProvider));
  }

  Future<void> setupTeamMatch({required String subjectId}) =>
      ref.read(challengeProvider.notifier).setupTeamMatch(subjectId: subjectId);

  void togglePlayerReady() => ref.read(challengeProvider.notifier).setReady();

  TeamChallengeState _map(ChallengeState challengeState) {
    final participants = challengeState.participants;
    TeamPlayer playerOf(dynamic participant) => TeamPlayer(
      id: participant.userId.toString(),
      name: participant.user?.name.toString() ?? 'طالب',
      status: participant.status.toString(),
    );
    final blue = participants
        .where((p) => p.team == 1)
        .map(playerOf)
        .toList(growable: false);
    final gold = participants
        .where((p) => p.team == 2)
        .map(playerOf)
        .toList(growable: false);
    return TeamChallengeState(
      status: challengeState.status,
      roomCode: challengeState.challenge?.id ?? '',
      blueTeam: blue,
      goldTeam: gold,
      blueScore: participants
          .where((p) => p.team == 1)
          .fold(0, (sum, p) => sum + p.score),
      goldScore: participants
          .where((p) => p.team == 2)
          .fold(0, (sum, p) => sum + p.score),
      errorMessage: challengeState.errorMessage,
    );
  }
}

final teamChallengeNotifierProvider =
    NotifierProvider<TeamChallengeNotifier, TeamChallengeState>(
      TeamChallengeNotifier.new,
    );
