import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/models/companion_enums.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/animated_companion.dart';
import '../../auth/providers/auth_provider.dart';

class CharacterCustomizationScreen extends ConsumerStatefulWidget {
  const CharacterCustomizationScreen({super.key});

  @override
  ConsumerState<CharacterCustomizationScreen> createState() =>
      _CharacterCustomizationScreenState();
}

class _CharacterCustomizationScreenState
    extends ConsumerState<CharacterCustomizationScreen> {
  late CompanionType _selectedType;
  CharacterEmotion _previewEmotion = CharacterEmotion.welcome;

  @override
  void initState() {
    super.initState();
    _selectedType =
        ref.read(authProvider)?.selectedCompanionType ?? CompanionType.male;
  }

  @override
  Widget build(BuildContext context) {
    final isMale = _selectedType == CompanionType.male;

    return AppScaffold(
      appBar: AppBar(
        title: const Text("تخصيص شخصية المساعد العلمي"),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: AppSpacing.sm),
            Text("اختر شخصية طالبك المفضل", style: AppTypography.pageTitle),
            const SizedBox(height: AppSpacing.xs),
            Text(
              "الشخصية ستصاحبك أثناء حل الأسئلة، وتقديم التلميحات، والاحتفال بالنتائج والإنجازات.",
              style: AppTypography.body,
            ),
            const SizedBox(height: AppSpacing.md),

            // --- GENDER SELECTION TOGGLE ---
            Row(
              children: [
                Expanded(
                  child: AppCard(
                    onTap: () =>
                        setState(() => _selectedType = CompanionType.male),
                    backgroundColor: isMale
                        ? AppColors.lightBlue
                        : AppColors.surface,
                    border: Border.all(
                      color: isMale ? AppColors.primaryBlue : AppColors.border,
                      width: isMale ? 2 : 1,
                    ),
                    child: Column(
                      children: [
                        const Text(
                          "👦 طالب (أحمد)",
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          "بالغترة والزي المدرسي",
                          style: AppTypography.caption,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: AppCard(
                    onTap: () =>
                        setState(() => _selectedType = CompanionType.female),
                    backgroundColor: !isMale
                        ? AppColors.lightTeal
                        : AppColors.surface,
                    border: Border.all(
                      color: !isMale
                          ? AppColors.secondaryTeal
                          : AppColors.border,
                      width: !isMale ? 2 : 1,
                    ),
                    child: Column(
                      children: [
                        const Text(
                          "👧 طالبة (أمل)",
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          "بالحجاب والزي المدرسي",
                          style: AppTypography.caption,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),

            // --- CHARACTER PREVIEW CARD VIA ANIMATED COMPANION ---
            Text("معاينة تفاعلات الشخصية", style: AppTypography.sectionTitle),
            const SizedBox(height: AppSpacing.xs),
            AppCard(
              child: Column(
                children: [
                  AnimatedCompanion(
                    companionType: _selectedType,
                    emotion: _previewEmotion,
                    message: _getEmotionSampleText(_previewEmotion, isMale),
                    size: CharacterSize.large,
                    showBubble: true,
                    blendWhiteBackground: false,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    "انقر على التعبيرات التالية لمعاينتها:",
                    style: AppTypography.caption,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    alignment: WrapAlignment.center,
                    children: [
                      _buildEmotionSampleChip(
                        "ترحيب 👋",
                        CharacterEmotion.welcome,
                      ),
                      _buildEmotionSampleChip(
                        "تفكير 🤔",
                        CharacterEmotion.thinking,
                      ),
                      _buildEmotionSampleChip(
                        "تلميح 💡",
                        CharacterEmotion.hint,
                      ),
                      _buildEmotionSampleChip(
                        "صحيح 👏",
                        CharacterEmotion.correct,
                      ),
                      _buildEmotionSampleChip("خطأ 😰", CharacterEmotion.wrong),
                      _buildEmotionSampleChip(
                        "فوز 🏆",
                        CharacterEmotion.victory,
                      ),
                      _buildEmotionSampleChip(
                        "إنجاز 🌟",
                        CharacterEmotion.achievement,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xl),

            // --- SAVE SELECTION BUTTON ---
            PrimaryButton(
              width: double.infinity,
              text: "حفظ الاختيار وتطبيقه 💾",
              onPressed: () {
                ref
                    .read(authProvider.notifier)
                    .updateCompanionType(_selectedType);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text(
                      "تم حفظ وتحديث الشخصية التفاعلية في كامل التطبيق!",
                    ),
                    backgroundColor: AppColors.successGreen,
                  ),
                );
                context.pop();
              },
            ),
            const SizedBox(height: AppSpacing.xxl),
          ],
        ),
      ),
    );
  }

  Widget _buildEmotionSampleChip(String label, CharacterEmotion emotion) {
    final isSelected = _previewEmotion == emotion;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (val) {
        if (val) setState(() => _previewEmotion = emotion);
      },
      selectedColor: AppColors.primaryBlue,
      backgroundColor: AppColors.surface,
      labelStyle: TextStyle(
        color: isSelected ? Colors.white : AppColors.darkText,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        fontSize: 11,
      ),
    );
  }

  String _getEmotionSampleText(CharacterEmotion emotion, bool isMale) {
    switch (emotion) {
      case CharacterEmotion.welcome:
        return isMale
            ? "أهلاً بك! أنا أحمد مساعدك في الثانوية العامة."
            : "أهلاً بكِ! أنا أمل مساعدتك في الثانوية العامة.";
      case CharacterEmotion.thinking:
        return "فكر في معطيات المسألة جيداً قبل الاختيار...";
      case CharacterEmotion.hint:
        return "تلميح: تذكر قانون كمية التحرك F = dP / dt 💡";
      case CharacterEmotion.correct:
        return "إجابة ممتازة وسريعة! واصل التفوق 👏";
      case CharacterEmotion.wrong:
        return "لا تقلق! اقرأ التفسير ومستواك سيتطور بسرعة.";
      case CharacterEmotion.victory:
        return "مبروك الفوز الباهر والسيطرة على التحدي 🏆";
      case CharacterEmotion.achievement:
        return "فتح إنجاز جديد! أنت بطل حقيقي 🌟";
      default:
        return "أنا جاهز لمساعدتك دائماً!";
    }
  }
}
