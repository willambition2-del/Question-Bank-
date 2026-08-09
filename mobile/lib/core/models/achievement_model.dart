class AchievementModel {
  final String id;
  final String title;
  final String description;
  final String badgeIcon;
  final bool isUnlocked;
  final String? unlockedAt;
  final double progress; // 0.0 to 1.0
  final int rewardPoints;
  final String rarity; // 'common', 'rare', 'epic'

  const AchievementModel({
    required this.id,
    required this.title,
    required this.description,
    required this.badgeIcon,
    required this.isUnlocked,
    this.unlockedAt,
    required this.progress,
    required this.rewardPoints,
    required this.rarity,
  });

  AchievementModel copyWith({
    String? id,
    String? title,
    String? description,
    String? badgeIcon,
    bool? isUnlocked,
    String? unlockedAt,
    double? progress,
    int? rewardPoints,
    String? rarity,
  }) {
    return AchievementModel(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      badgeIcon: badgeIcon ?? this.badgeIcon,
      isUnlocked: isUnlocked ?? this.isUnlocked,
      unlockedAt: unlockedAt ?? this.unlockedAt,
      progress: progress ?? this.progress,
      rewardPoints: rewardPoints ?? this.rewardPoints,
      rarity: rarity ?? this.rarity,
    );
  }
}
