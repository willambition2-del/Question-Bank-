import 'package:flutter/material.dart';

abstract final class AppColors {
  // Brand Primary & Dark
  static const Color primaryBlue = Color(0xFF2F5BEA);
  static const Color primaryDark = Color(0xFF173EA8);
  static const Color secondaryTeal = Color(0xFF12B886);
  static const Color goldAccent = Color(0xFFF6B91A);
  static const Color warmOrange = Color(0xFFF59E0B);

  // Status Colors
  static const Color successGreen = Color(0xFF12B886);
  static const Color warning = Color(0xFFF6B91A);
  static const Color errorCoral = Color(0xFFEF5361);
  static const Color info = Color(0xFF25A6D9);

  // Text Colors
  static const Color darkText = Color(0xFF17213D);
  static const Color secondaryText = Color(0xFF7D8496);
  static const Color mutedText = Color(0xFFA3ACBA);

  // Neutral Colors
  static const Color background = Color(0xFFF6F8FC);
  static const Color cardBackground = Color(0xFFFFFFFF);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color border = Color(0xFFE5E9F2);

  // Soft Accents & Tints
  static const Color lightBlue = Color(0xFFEDF3FF);
  static const Color lightTeal = Color(0xE8FBF7FF);
  static const Color lightGold = Color(0xFFFFF7DA);
  static const Color lightError = Color(0xFFFDEDEF);

  // Gradients
  static const Gradient primaryGradient = LinearGradient(
    colors: [primaryBlue, primaryDark],
    begin: Alignment.topRight,
    end: Alignment.bottomLeft,
  );

  static const Gradient blueDarkToLightGradient = LinearGradient(
    colors: [primaryBlue, lightBlue],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  static const Gradient goldToOrangeGradient = LinearGradient(
    colors: [goldAccent, warmOrange],
    begin: Alignment.centerRight,
    end: Alignment.centerLeft,
  );

  static const Gradient tealToGreenGradient = LinearGradient(
    colors: [info, successGreen],
    begin: Alignment.centerRight,
    end: Alignment.centerLeft,
  );
}
