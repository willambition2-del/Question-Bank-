class QuizAttempt {
  final String id;
  final int userId;
  final String
  quizType; // 'subject', 'unit', 'lesson', 'exam', 'quick', 'weakness', 'mistakes', 'saved'
  final String subjectId;
  final String? unitId;
  final String? lessonId;
  final String? examModelId;
  final int totalQuestions;
  final int correctCount;
  final int wrongCount;
  final int unansweredCount;
  final double scorePercent; // 0.0 to 100.0
  final int durationSeconds;
  final String startedAt;
  final String completedAt;

  const QuizAttempt({
    required this.id,
    required this.userId,
    required this.quizType,
    required this.subjectId,
    this.unitId,
    this.lessonId,
    this.examModelId,
    required this.totalQuestions,
    required this.correctCount,
    required this.wrongCount,
    required this.unansweredCount,
    required this.scorePercent,
    required this.durationSeconds,
    required this.startedAt,
    required this.completedAt,
  });

  QuizAttempt copyWith({
    String? id,
    int? userId,
    String? quizType,
    String? subjectId,
    String? unitId,
    String? lessonId,
    String? examModelId,
    int? totalQuestions,
    int? correctCount,
    int? wrongCount,
    int? unansweredCount,
    double? scorePercent,
    int? durationSeconds,
    String? startedAt,
    String? completedAt,
  }) {
    return QuizAttempt(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      quizType: quizType ?? this.quizType,
      subjectId: subjectId ?? this.subjectId,
      unitId: unitId ?? this.unitId,
      lessonId: lessonId ?? this.lessonId,
      examModelId: examModelId ?? this.examModelId,
      totalQuestions: totalQuestions ?? this.totalQuestions,
      correctCount: correctCount ?? this.correctCount,
      wrongCount: wrongCount ?? this.wrongCount,
      unansweredCount: unansweredCount ?? this.unansweredCount,
      scorePercent: scorePercent ?? this.scorePercent,
      durationSeconds: durationSeconds ?? this.durationSeconds,
      startedAt: startedAt ?? this.startedAt,
      completedAt: completedAt ?? this.completedAt,
    );
  }
}
