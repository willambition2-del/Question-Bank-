import 'package:flutter/material.dart';
import 'app_colors.dart';

abstract final class AppShadows {
  static const BoxShadow soft = BoxShadow(
    color: Color(0x0A17213D),
    blurRadius: 10,
    offset: Offset(0, 4),
  );

  static const BoxShadow card = BoxShadow(
    color: Color(0x0F17213D),
    blurRadius: 16,
    offset: Offset(0, 6),
  );

  static const BoxShadow elevated = BoxShadow(
    color: Color(0x1A2F5BEA),
    blurRadius: 20,
    offset: Offset(0, 8),
  );
}
