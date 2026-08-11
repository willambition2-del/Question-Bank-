class LessonModel {
  final String id;
  final String subjectId;
  final String unitId;
  final String name;
  final String description;
  final int questionsCount;
  final int correctCount;
  final int wrongCount;
  final double masteryPercent;
  final String? lastAttempt;
  final String
  status; // 'notStarted', 'inStudy', 'good', 'mastered', 'needsReview'

  const LessonModel({
    required this.id,
    required this.subjectId,
    required this.unitId,
    required this.name,
    required this.description,
    required this.questionsCount,
    required this.correctCount,
    required this.wrongCount,
    required this.masteryPercent,
    this.lastAttempt,
    required this.status,
  });

  LessonModel copyWith({
    String? id,
    String? subjectId,
    String? unitId,
    String? name,
    String? description,
    int? questionsCount,
    int? correctCount,
    int? wrongCount,
    double? masteryPercent,
    String? lastAttempt,
    String? status,
  }) {
    return LessonModel(
      id: id ?? this.id,
      subjectId: subjectId ?? this.subjectId,
      unitId: unitId ?? this.unitId,
      name: name ?? this.name,
      description: description ?? this.description,
      questionsCount: questionsCount ?? this.questionsCount,
      correctCount: correctCount ?? this.correctCount,
      wrongCount: wrongCount ?? this.wrongCount,
      masteryPercent: masteryPercent ?? this.masteryPercent,
      lastAttempt: lastAttempt ?? this.lastAttempt,
      status: status ?? this.status,
    );
  }
}
