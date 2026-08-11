import 'package:flutter/material.dart';

abstract final class AppShadows {
  static const BoxShadow card = BoxShadow(
    color: Color(0x0A17213D),
    offset: Offset(0, 4),
    blurRadius: 16,
    spreadRadius: 0,
  );

  static const BoxShadow soft = BoxShadow(
    color: Color(0x0517213D),
    offset: Offset(0, 2),
    blurRadius: 8,
    spreadRadius: 0,
  );

  static const BoxShadow primaryButton = BoxShadow(
    color: Color(0x26315BE8),
    offset: Offset(0, 4),
    blurRadius: 12,
    spreadRadius: 0,
  );

  static const BoxShadow goldButton = BoxShadow(
    color: Color(0x26F6C445),
    offset: Offset(0, 4),
    blurRadius: 12,
    spreadRadius: 0,
  );
}
