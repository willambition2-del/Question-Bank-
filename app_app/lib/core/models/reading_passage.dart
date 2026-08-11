class ReadingPassage {
  final String id;
  final String title;
  final String passageText;
  final String subjectId;
  final String? source;
  final List<String> questionIds;

  String get content => passageText;

  const ReadingPassage({
    required this.id,
    required this.title,
    required this.passageText,
    required this.subjectId,
    this.source,
    required this.questionIds,
  });

  ReadingPassage copyWith({
    String? id,
    String? title,
    String? passageText,
    String? subjectId,
    String? source,
    List<String>? questionIds,
  }) {
    return ReadingPassage(
      id: id ?? this.id,
      title: title ?? this.title,
      passageText: passageText ?? this.passageText,
      subjectId: subjectId ?? this.subjectId,
      source: source ?? this.source,
      questionIds: questionIds ?? this.questionIds,
    );
  }
}
