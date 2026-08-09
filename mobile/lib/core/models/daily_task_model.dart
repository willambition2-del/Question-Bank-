class DailyTaskModel {
  final String id;
  final String description;
  final int targetCount;
  final int currentCount;
  final int rewardPoints;
  final bool isCompleted;

  const DailyTaskModel({
    required this.id,
    required this.description,
    required this.targetCount,
    required this.currentCount,
    required this.rewardPoints,
    required this.isCompleted,
  });

  DailyTaskModel copyWith({
    String? id,
    String? description,
    int? targetCount,
    int? currentCount,
    int? rewardPoints,
    bool? isCompleted,
  }) {
    return DailyTaskModel(
      id: id ?? this.id,
      description: description ?? this.description,
      targetCount: targetCount ?? this.targetCount,
      currentCount: currentCount ?? this.currentCount,
      rewardPoints: rewardPoints ?? this.rewardPoints,
      isCompleted: isCompleted ?? this.isCompleted,
    );
  }
}
