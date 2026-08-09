class UnitModel {
  final String id;
  final String subjectId;
  final String name;
  final String description;
  final int lessonsCount;
  final int questionsCount;
  final double progressPercent;
  final String status; // 'notStarted', 'inProgress', 'completed'

  const UnitModel({
    required this.id,
    required this.subjectId,
    required this.name,
    required this.description,
    required this.lessonsCount,
    required this.questionsCount,
    required this.progressPercent,
    required this.status,
  });

  UnitModel copyWith({
    String? id,
    String? subjectId,
    String? name,
    String? description,
    int? lessonsCount,
    int? questionsCount,
    double? progressPercent,
    String? status,
  }) {
    return UnitModel(
      id: id ?? this.id,
      subjectId: subjectId ?? this.subjectId,
      name: name ?? this.name,
      description: description ?? this.description,
      lessonsCount: lessonsCount ?? this.lessonsCount,
      questionsCount: questionsCount ?? this.questionsCount,
      progressPercent: progressPercent ?? this.progressPercent,
      status: status ?? this.status,
    );
  }
}
