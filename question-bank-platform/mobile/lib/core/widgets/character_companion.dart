import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../models/companion_enums.dart';
import '../utils/character_asset_resolver.dart';
import '../../app/theme/design_tokens.dart';

class CharacterCompanion extends StatelessWidget {
  final CompanionType companionType;
  final CharacterEmotion emotion;
  final String? message;
  final CharacterSize size;
  final CharacterAlignment alignment;
  final bool showBubble;
  final bool animate;
  final double? customHeight;

  const CharacterCompanion({
    super.key,
    this.companionType = CompanionType.male,
    required this.emotion,
    this.message,
    this.size = CharacterSize.medium,
    this.alignment = CharacterAlignment.center,
    this.showBubble = true,
    this.animate = true,
    this.customHeight,
  });

  double _getAvatarHeight() {
    if (customHeight != null) return customHeight!;
    switch (size) {
      case CharacterSize.small:
        return 72.0;
      case CharacterSize.medium:
        return 125.0;
      case CharacterSize.large:
        return 220.0;
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

    Widget imageWidget = Image.asset(
      assetPath,
      height: avatarHeight,
      fit: BoxFit.contain,
      alignment: _getAlignmentDirectional(),
      filterQuality: FilterQuality.high,
      gaplessPlayback: true,
      errorBuilder: (context, error, stackTrace) =>
          _buildFallbackWidget(context, avatarHeight),
    );

    if (animate) {
      if (emotion == CharacterEmotion.wrong ||
          emotion == CharacterEmotion.timeout) {
        imageWidget = imageWidget.animate().shake(
          duration: AppDurations.normal,
          hz: 6,
        );
      } else if (emotion == CharacterEmotion.correct ||
          emotion == CharacterEmotion.victory) {
        imageWidget = imageWidget.animate().scale(
          duration: AppDurations.slow,
          begin: const Offset(0.95, 0.95),
          end: const Offset(1.0, 1.0),
        );
      } else {
        imageWidget = imageWidget
            .animate()
            .slideY(
              begin: 0.03,
              end: 0,
              duration: AppDurations.normal,
              curve: Curves.easeOut,
            )
            .fadeIn();
      }
    }

    return Directionality(
      textDirection: TextDirection.rtl,
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
          imageWidget,
        ],
      ),
    );
  }

  Widget _buildFallbackWidget(BuildContext context, double height) {
    final fallbackAsset = CharacterAssetResolver.resolveNeutral(
      type: companionType,
    );
    return Image.asset(
      fallbackAsset,
      height: height,
      fit: BoxFit.contain,
      alignment: _getAlignmentDirectional(),
    );
  }
}

class CharacterSpeechBubble extends StatelessWidget {
  final String message;

  const CharacterSpeechBubble({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 260),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        boxShadow: const [AppShadows.soft],
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Text(
        message,
        style: AppTypography.body.copyWith(
          color: AppColors.darkText,
          fontWeight: FontWeight.w600,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }
}

class CharacterReactionOverlay extends StatelessWidget {
  final CharacterEmotion emotion;
  final String title;
  final String subtitle;
  final VoidCallback onClose;

  const CharacterReactionOverlay({
    super.key,
    required this.emotion,
    required this.title,
    required this.subtitle,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black.withOpacity(0.5),
      child: Center(
        child: Container(
          margin: const EdgeInsets.all(AppSpacing.xl),
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadius.xl),
            boxShadow: const [AppShadows.card],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CharacterCompanion(
                emotion: emotion,
                size: CharacterSize.large,
                showBubble: false,
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                title,
                style: AppTypography.pageTitle,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                subtitle,
                style: AppTypography.body,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.lg),
              ElevatedButton(
                onPressed: onClose,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryBlue,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 32,
                    vertical: 12,
                  ),
                ),
                child: const Text(
                  'متابعة',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
