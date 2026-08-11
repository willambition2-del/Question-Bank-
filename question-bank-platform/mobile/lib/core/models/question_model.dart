import 'package:flutter/foundation.dart';

@immutable
class QuestionModel {
  final String id;
  final String subjectId;
  final String unitId;
  final String lessonId;
  final String? readingPassageId;
  final String questionType; // 'multipleChoice', 'trueFalse'
  final String questionText;
  final Map<String, String>
  options; // Key is option ID (e.g. 'A', 'B'), value is text
  final String correctOptionId;
  final String hintText;
  final String explanationShort;
  final String explanationDetailed;
  final String difficulty; // 'easy', 'medium', 'hard'
  final String? dangerKeyword; // e.g. "ليس", "باستثناء"
  final bool isTrapQuestion;
  final bool isSaved;
  final bool isDeferred;
  final bool answeredBefore;
  final bool wasWrongBefore;
  final int timesWrong;
  final int estimatedTimeSeconds;

  bool get isTrickQuestion => isTrapQuestion;

  const QuestionModel({
    required this.id,
    required this.subjectId,
    required this.unitId,
    required this.lessonId,
    this.readingPassageId,
    required this.questionType,
    required this.questionText,
    required this.options,
    required this.correctOptionId,
    required this.hintText,
    required this.explanationShort,
    required this.explanationDetailed,
    required this.difficulty,
    this.dangerKeyword,
    required this.isTrapQuestion,
    required this.isSaved,
    required this.isDeferred,
    required this.answeredBefore,
    required this.wasWrongBefore,
    required this.timesWrong,
    required this.estimatedTimeSeconds,
  });

  QuestionModel copyWith({
    String? id,
    String? subjectId,
    String? unitId,
    String? lessonId,
    String? readingPassageId,
    String? questionType,
    String? questionText,
    Map<String, String>? options,
    String? correctOptionId,
    String? hintText,
    String? explanationShort,
    String? explanationDetailed,
    String? difficulty,
    String? dangerKeyword,
    bool? isTrapQuestion,
    bool? isSaved,
    bool? isDeferred,
    bool? answeredBefore,
    bool? wasWrongBefore,
    int? timesWrong,
    int? estimatedTimeSeconds,
  }) {
    return QuestionModel(
      id: id ?? this.id,
      subjectId: subjectId ?? this.subjectId,
      unitId: unitId ?? this.unitId,
      lessonId: lessonId ?? this.lessonId,
      readingPassageId: readingPassageId ?? this.readingPassageId,
      questionType: questionType ?? this.questionType,
      questionText: questionText ?? this.questionText,
      options: options ?? this.options,
      correctOptionId: correctOptionId ?? this.correctOptionId,
      hintText: hintText ?? this.hintText,
      explanationShort: explanationShort ?? this.explanationShort,
      explanationDetailed: explanationDetailed ?? this.explanationDetailed,
      difficulty: difficulty ?? this.difficulty,
      dangerKeyword: dangerKeyword ?? this.dangerKeyword,
      isTrapQuestion: isTrapQuestion ?? this.isTrapQuestion,
      isSaved: isSaved ?? this.isSaved,
      isDeferred: isDeferred ?? this.isDeferred,
      answeredBefore: answeredBefore ?? this.answeredBefore,
      wasWrongBefore: wasWrongBefore ?? this.wasWrongBefore,
      timesWrong: timesWrong ?? this.timesWrong,
      estimatedTimeSeconds: estimatedTimeSeconds ?? this.estimatedTimeSeconds,
    );
  }
}
