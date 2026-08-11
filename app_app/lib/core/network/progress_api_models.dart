import 'api_response.dart';
import 'quiz_api_models.dart';

final class MistakeRecord {
  final QuizQuestion question;
  final int attemptsCount;
  final int correctCount;
  final int wrongCount;
  final int consecutiveWrong;
  final double masteryScore;
  final bool isMastered;
  final bool reviewed;
  final DateTime? manualReviewedAt;
  final DateTime? lastAnsweredAt;
  final int? lastTimeMs;

  const MistakeRecord({
    required this.question,
    required this.attemptsCount,
    required this.correctCount,
    required this.wrongCount,
    required this.consecutiveWrong,
    required this.masteryScore,
    required this.isMastered,
    required this.reviewed,
    this.manualReviewedAt,
    this.lastAnsweredAt,
    this.lastTimeMs,
  });

  factory MistakeRecord.fromJson(Map<String, dynamic> json) => MistakeRecord(
    question: QuizQuestion.fromJson(
      requireObject(json['question'], 'question'),
    ),
    attemptsCount: (json['attemptsCount'] as num?)?.toInt() ?? 0,
    correctCount: (json['correctCount'] as num?)?.toInt() ?? 0,
    wrongCount: (json['wrongCount'] as num?)?.toInt() ?? 0,
    consecutiveWrong: (json['consecutiveWrong'] as num?)?.toInt() ?? 0,
    masteryScore: (json['masteryScore'] as num?)?.toDouble() ?? 0,
    isMastered: json['isMastered'] == true,
    reviewed: json['reviewed'] == true,
    manualReviewedAt: _date(json['manualReviewedAt']),
    lastAnsweredAt: _date(json['lastAnsweredAt']),
    lastTimeMs: (json['lastTimeMs'] as num?)?.toInt(),
  );
}

final class MistakesPage {
  final List<MistakeRecord> items;
  final PageMeta meta;
  const MistakesPage(this.items, this.meta);
}

final class MistakeReview {
  final String questionId;
  final bool reviewed;
  final bool isMastered;
  final DateTime? manualReviewedAt;

  const MistakeReview({
    required this.questionId,
    required this.reviewed,
    required this.isMastered,
    this.manualReviewedAt,
  });

  factory MistakeReview.fromJson(Map<String, dynamic> json) => MistakeReview(
    questionId: json['questionId']?.toString() ?? '',
    reviewed: json['reviewStatus'] == 'REVIEWED',
    isMastered: json['isMastered'] == true,
    manualReviewedAt: _date(json['manualReviewedAt']),
  );
}

final class SavedQuestionRecord {
  final String id;
  final QuizQuestion question;
  final String? note;
  final DateTime savedAt;
  final DateTime updatedAt;

  const SavedQuestionRecord({
    required this.id,
    required this.question,
    this.note,
    required this.savedAt,
    required this.updatedAt,
  });

  factory SavedQuestionRecord.fromJson(Map<String, dynamic> json) =>
      SavedQuestionRecord(
        id: json['id']?.toString() ?? '',
        question: QuizQuestion.fromJson(
          requireObject(json['question'], 'question'),
        ),
        note: json['note']?.toString(),
        savedAt:
            _date(json['savedAt']) ??
            DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
        updatedAt:
            _date(json['updatedAt']) ??
            DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      );
}

final class SavedQuestionsPage {
  final List<SavedQuestionRecord> items;
  final PageMeta meta;
  const SavedQuestionsPage(this.items, this.meta);
}

final class SavedQuestionRemoval {
  final String questionId;
  final bool removed;
  const SavedQuestionRemoval(this.questionId, this.removed);

  factory SavedQuestionRemoval.fromJson(Map<String, dynamic> json) =>
      SavedQuestionRemoval(
        json['questionId']?.toString() ?? '',
        json['removed'] == true,
      );
}

DateTime? _date(Object? value) =>
    value == null ? null : DateTime.tryParse(value.toString())?.toUtc();
