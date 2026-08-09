import '../models/companion_enums.dart';
import 'character_expression_registry.dart';

abstract final class CharacterAssetRegistry {
  /// Resolves character asset path based on gender and emotion/mood via CharacterExpressionRegistry.
  static String resolveAsset({
    required CompanionType companionType,
    required CharacterEmotion emotion,
  }) {
    return CharacterExpressionRegistry.getAssetPath(
      companionType: companionType,
      emotion: emotion,
    );
  }

  /// Safe fallback returning neutral asset for the specified gender.
  static String resolveNeutralAsset({required CompanionType companionType}) {
    return CharacterExpressionRegistry.getNeutralAssetPath(companionType);
  }

  /// Resolves avatar tile image by index (1 to 20) for the specified gender.
  static String resolveAvatarAsset({
    required CompanionType companionType,
    int index = 1,
  }) {
    final safeIndex = index.clamp(1, 20);
    final isMale = companionType == CompanionType.male;
    final folder = isMale ? 'male' : 'female';
    final prefix = isMale ? 'male' : 'female';
    return 'assets/$folder/${prefix}_$safeIndex.jpg';
  }
}
