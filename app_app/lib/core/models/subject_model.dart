class SubjectModel {
  final String id;
  final String name;
  final String icon;
  final String colorHex;
  final String? coverImageUrl;
  final int unitsCount;
  final int lessonsCount;
  final int questionsCount;
  final double progressPercent; // 0.0 to 1.0
  final int correctAnswers;
  final int wrongAnswers;
  final double masteryPercent; // 0.0 to 1.0
  final bool isFavorite;
  final String? lastActivity;

  const SubjectModel({
    required this.id,
    required this.name,
    required this.icon,
    required this.colorHex,
    this.coverImageUrl,
    required this.unitsCount,
    required this.lessonsCount,
    required this.questionsCount,
    required this.progressPercent,
    required this.correctAnswers,
    required this.wrongAnswers,
    required this.masteryPercent,
    required this.isFavorite,
    this.lastActivity,
  });

  SubjectModel copyWith({
    String? id,
    String? name,
    String? icon,
    String? colorHex,
    String? coverImageUrl,
    int? unitsCount,
    int? lessonsCount,
    int? questionsCount,
    double? progressPercent,
    int? correctAnswers,
    int? wrongAnswers,
    double? masteryPercent,
    bool? isFavorite,
    String? lastActivity,
  }) {
    return SubjectModel(
      id: id ?? this.id,
      name: name ?? this.name,
      icon: icon ?? this.icon,
      colorHex: colorHex ?? this.colorHex,
      coverImageUrl: coverImageUrl ?? this.coverImageUrl,
      unitsCount: unitsCount ?? this.unitsCount,
      lessonsCount: lessonsCount ?? this.lessonsCount,
      questionsCount: questionsCount ?? this.questionsCount,
      progressPercent: progressPercent ?? this.progressPercent,
      correctAnswers: correctAnswers ?? this.correctAnswers,
      wrongAnswers: wrongAnswers ?? this.wrongAnswers,
      masteryPercent: masteryPercent ?? this.masteryPercent,
      isFavorite: isFavorite ?? this.isFavorite,
      lastActivity: lastActivity ?? this.lastActivity,
    );
  }
}
