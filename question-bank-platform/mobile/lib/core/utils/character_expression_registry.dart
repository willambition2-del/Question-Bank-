import '../models/companion_enums.dart';

abstract final class CharacterExpressionRegistry {
  /// Deterministically maps each CharacterEmotion to a specific asset path.
  static String getAssetPath({
    required CompanionType companionType,
    required CharacterEmotion emotion,
  }) {
    final isMale = companionType == CompanionType.male;
    final folder = isMale ? 'male' : 'female';
    final prefix = isMale ? 'male' : 'female';

    final int index = getExpressionIndex(emotion);
    return 'assets/$folder/${prefix}_$index.jpg';
  }

  /// Explicit mapping from emotion to avatar image index (1 to 12).
  static int getExpressionIndex(CharacterEmotion emotion) {
    switch (emotion) {
      case CharacterEmotion.welcome:
      case CharacterEmotion.motivate:
      case CharacterEmotion.neutral:
        return 1;
      case CharacterEmotion.thinking:
      case CharacterEmotion.waiting:
        return 2;
      case CharacterEmotion.hint:
      case CharacterEmotion.recommendedLesson:
        return 3;
      case CharacterEmotion.warning:
      case CharacterEmotion.difficultQuestion:
        return 4;
      case CharacterEmotion.correct:
      case CharacterEmotion.fastCorrect:
      case CharacterEmotion.happy:
        return 5;
      case CharacterEmotion.wrong:
      case CharacterEmotion.timeout:
        return 6;
      case CharacterEmotion.streak:
      case CharacterEmotion.weaknessReview:
        return 7;
      case CharacterEmotion.victory:
      case CharacterEmotion.excellentResult:
        return 8;
      case CharacterEmotion.defeatSportsmanship:
      case CharacterEmotion.weakResult:
      case CharacterEmotion.support:
        return 9;
      case CharacterEmotion.readyForChallenge:
      case CharacterEmotion.challengeExcited:
        return 10;
      case CharacterEmotion.revengeChallenge:
      case CharacterEmotion.mediumResult:
        return 11;
      case CharacterEmotion.achievement:
      case CharacterEmotion.teamCelebration:
      case CharacterEmotion.celebrate:
        return 12;
    }
  }

  /// Safe fallback neutral asset.
  static String getNeutralAssetPath(CompanionType companionType) {
    final isMale = companionType == CompanionType.male;
    return isMale ? 'assets/male/male_1.jpg' : 'assets/female/female_1.jpg';
  }
}
