import 'package:flutter_test/flutter_test.dart';
import 'package:app_app/features/challenges/providers/team_challenge_provider.dart';

void main() {
  group('Team Challenge 2v2 State & Formation Tests', () {
    test('Initial TeamChallengeState has honest feature flag enabled', () {
      const state = TeamChallengeState();
      expect(state.teamChallengeEnabled, isTrue);
      expect(state.status, equals('modeSelect'));
    });

    test('TeamPlayer model holds ready status correctly', () {
      const player = TeamPlayer(
        id: "p1",
        name: "أحمد",
        level: 12,
        status: "ready",
      );
      expect(player.status, equals("ready"));
      expect(player.isMvp, isFalse);
    });
  });
}
