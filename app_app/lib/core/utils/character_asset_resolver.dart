import '../models/companion_enums.dart';
import 'character_asset_registry.dart';

abstract final class CharacterAssetResolver {
  /// Resolves standard character asset for a given type and mood/emotion.
  static String resolve({
    required CompanionType type,
    required CharacterEmotion mood,
  }) {
    return CharacterAssetRegistry.resolveAsset(
      companionType: type,
      emotion: mood,
    );
  }

  /// Safe fallback returning neutral asset for the specified gender.
  static String resolveNeutral({required CompanionType type}) {
    return CharacterAssetRegistry.resolveNeutralAsset(companionType: type);
  }

  /// Resolves indexed avatar asset (1 to 20) for the specified gender.
  static String resolveAvatar({required CompanionType type, int index = 1}) {
    return CharacterAssetRegistry.resolveAvatarAsset(
      companionType: type,
      index: index,
    );
  }
}
