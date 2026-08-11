import 'package:flutter/material.dart';

abstract final class AchievementAssetResolver {
  static const Map<String, IconData> _icons = {
    'flag': Icons.flag,
    'emoji_events': Icons.emoji_events,
    'local_fire_department': Icons.local_fire_department,
    'explore': Icons.explore,
    'star': Icons.star,
    'quiz': Icons.quiz,
    'correct_answers': Icons.check_circle,
    'streak': Icons.local_fire_department,
    'mastery': Icons.workspace_premium,
    'challenge': Icons.sports_esports,
  };

  static IconData iconFor(String key) =>
      _icons[key.toLowerCase()] ?? Icons.emoji_events_outlined;
}
