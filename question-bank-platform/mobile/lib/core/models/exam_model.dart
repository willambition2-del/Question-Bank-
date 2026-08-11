class ExamModel {
  final String id;
  final String title;
  final String subjectId;
  final String sourceId; // e.g. 'صنعاء', 'عدن'
  final int year;
  final int questionsCount;
  final int durationMinutes;
  final String difficulty; // 'easy', 'medium', 'hard'
  final int attemptsCount;
  final double? bestScore;
  final bool isCompleted;
  final bool isOfficial;

  const ExamModel({
    required this.id,
    required this.title,
    required this.subjectId,
    required this.sourceId,
    required this.year,
    required this.questionsCount,
    required this.durationMinutes,
    required this.difficulty,
    required this.attemptsCount,
    this.bestScore,
    required this.isCompleted,
    required this.isOfficial,
  });

  ExamModel copyWith({
    String? id,
    String? title,
    String? subjectId,
    String? sourceId,
    int? year,
    int? questionsCount,
    int? durationMinutes,
    String? difficulty,
    int? attemptsCount,
    double? bestScore,
    bool? isCompleted,
    bool? isOfficial,
  }) {
    return ExamModel(
      id: id ?? this.id,
      title: title ?? this.title,
      subjectId: subjectId ?? this.subjectId,
      sourceId: sourceId ?? this.sourceId,
      year: year ?? this.year,
      questionsCount: questionsCount ?? this.questionsCount,
      durationMinutes: durationMinutes ?? this.durationMinutes,
      difficulty: difficulty ?? this.difficulty,
      attemptsCount: attemptsCount ?? this.attemptsCount,
      bestScore: bestScore ?? this.bestScore,
      isCompleted: isCompleted ?? this.isCompleted,
      isOfficial: isOfficial ?? this.isOfficial,
    );
  }
}
