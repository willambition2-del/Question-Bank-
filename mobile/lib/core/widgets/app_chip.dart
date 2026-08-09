import 'package:flutter/material.dart';
import '../../app/theme/design_tokens.dart';

class AppChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final ValueChanged<bool>? onSelected;
  final Color? activeColor;
  final IconData? icon;

  const AppChip({
    super.key,
    required this.label,
    required this.isSelected,
    this.onSelected,
    this.activeColor,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final chipColor = activeColor ?? AppColors.primaryBlue;

    return ChoiceChip(
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(
              icon,
              size: 14,
              color: isSelected ? Colors.white : AppColors.secondaryText,
            ),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: AppTypography.caption.copyWith(
              color: isSelected ? Colors.white : AppColors.secondaryText,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ],
      ),
      selected: isSelected,
      onSelected: onSelected,
      selectedColor: chipColor,
      backgroundColor: AppColors.surface,
      elevation: 0,
      pressElevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.pill),
        side: BorderSide(
          color: isSelected ? Colors.transparent : AppColors.border,
        ),
      ),
    );
  }
}
