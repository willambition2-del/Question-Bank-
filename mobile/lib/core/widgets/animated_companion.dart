import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../models/companion_enums.dart';
import '../utils/character_asset_resolver.dart';
import '../../app/theme/design_tokens.dart';
import 'character_companion.dart';

class AnimatedCompanion extends StatelessWidget {
  final CompanionType companionType;
  final CharacterEmotion emotion;
  final String? message;
  final CharacterSize size;
  final CharacterAlignment alignment;
  final bool showBubble;
  final double? customHeight;
  final VoidCallback? onTap;
  final bool blendWhiteBackground;

  const AnimatedCompanion({
    super.key,
    this.companionType = CompanionType.male,
    required this.emotion,
    this.message,
    this.size = CharacterSize.medium,
    this.alignment = CharacterAlignment.center,
    this.showBubble = true,
    this.customHeight,
    this.onTap,
    this.blendWhiteBackground = true,
  });

  double _getAvatarHeight() {
    if (customHeight != null) return customHeight!;
    switch (size) {
      case CharacterSize.small:
        return 75.0;
      case CharacterSize.medium:
        return 130.0;
      case CharacterSize.large:
        return 225.0;
    }
  }

  AlignmentGeometry _getAlignmentDirectional() {
    switch (alignment) {
      case CharacterAlignment.bottomLeft:
        return AlignmentDirectional.bottomStart;
      case CharacterAlignment.bottomRight:
        return AlignmentDirectional.bottomEnd;
      case CharacterAlignment.center:
        return AlignmentDirectional.bottomCenter;
    }
  }

  @override
  Widget build(BuildContext context) {
    final avatarHeight = _getAvatarHeight();
    final assetPath = CharacterAssetResolver.resolve(
      type: companionType,
      mood: emotion,
    );

    Widget companionImage = Image.asset(
      assetPath,
      height: avatarHeight,
      fit: BoxFit.contain,
      alignment: _getAlignmentDirectional(),
      filterQuality: FilterQuality.high,
      gaplessPlayback: true,
      errorBuilder: (context, error, stackTrace) {
        final fallbackAsset = CharacterAssetResolver.resolveNeutral(
          type: companionType,
        );
        return Image.asset(
          fallbackAsset,
          height: avatarHeight,
          fit: BoxFit.contain,
          alignment: _getAlignmentDirectional(),
        );
      },
    );

    // Apply micro-animations based on emotion
    if (emotion == CharacterEmotion.wrong ||
        emotion == CharacterEmotion.timeout) {
      companionImage = companionImage
          .animate(key: ValueKey(emotion))
          .shake(duration: AppDurations.normal, hz: 5);
    } else if (emotion == CharacterEmotion.correct ||
        emotion == CharacterEmotion.victory ||
        emotion == CharacterEmotion.excellentResult) {
      companionImage = companionImage
          .animate(key: ValueKey(emotion))
          .scale(
            duration: AppDurations.slow,
            begin: const Offset(0.94, 0.94),
            end: const Offset(1.0, 1.0),
            curve: Curves.easeOutBack,
          )
          .fadeIn(duration: AppDurations.fast);
    } else {
      companionImage = companionImage
          .animate(key: ValueKey(emotion))
          .slideY(
            begin: 0.04,
            end: 0.0,
            duration: AppDurations.normal,
            curve: Curves.easeOut,
          )
          .fadeIn(duration: AppDurations.fast);
    }

    if (blendWhiteBackground) {
      companionImage = Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppRadius.md),
          boxShadow: const [AppShadows.soft],
        ),
        child: companionImage,
      );
    }

    Widget content = FittedBox(
      fit: BoxFit.scaleDown,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: alignment == CharacterAlignment.bottomLeft
            ? CrossAxisAlignment.start
            : alignment == CharacterAlignment.bottomRight
            ? CrossAxisAlignment.end
            : CrossAxisAlignment.center,
        children: [
          if (showBubble && message != null && message!.isNotEmpty) ...[
            CharacterSpeechBubble(message: message!),
            const SizedBox(height: AppSpacing.xs),
          ],
          companionImage,
        ],
      ),
    );

    if (onTap != null) {
      content = GestureDetector(onTap: onTap, child: content);
    }

    return Directionality(textDirection: TextDirection.rtl, child: content);
  }
}
