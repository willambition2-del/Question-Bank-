import '../models/reading_passage.dart';
import 'api_response.dart';

final class QuizQuestion {
  final String id;
  final String subjectId;
  final String? unitId;
  final String? lessonId;
  final String type;
  final String difficulty;
  final String questionText;
  final Map<String, String> options;
  final ReadingPassage? readingPassage;
  final bool isTrapQuestion;
  final bool answered;
  final String? selectedOptionId;
  final bool? selectedBoolean;

  const QuizQuestion({
    required this.id,
    required this.subjectId,
    this.unitId,
    this.lessonId,
    required this.type,
    required this.difficulty,
    required this.questionText,
    required this.options,
    this.readingPassage,
    required this.isTrapQuestion,
    this.answered = false,
    this.selectedOptionId,
    this.selectedBoolean,
  });

  bool get isTrickQuestion => isTrapQuestion;
  bool get isTrueFalse => type == 'TRUE_FALSE';

  factory QuizQuestion.fromJson(Map<String, dynamic> json) {
    final type = json['type']?.toString() ?? 'MULTIPLE_CHOICE';
    final rawOptions = json['options'] is List
        ? json['options'] as List
        : const [];
    final options = <String, String>{
      for (final raw in rawOptions)
        if (raw is Map && raw['id'] != null)
          raw['id'].toString(): raw['optionText']?.toString() ?? '',
    };
    if (type == 'TRUE_FALSE' && options.isEmpty) {
      options.addAll(const {'true': 'صح', 'false': 'خطأ'});
    }
    final passageJson = json['readingPassage'];
    final passage = passageJson is Map
        ? ReadingPassage(
            id: passageJson['id']?.toString() ?? '',
            title: passageJson['title']?.toString() ?? '',
            passageText: passageJson['passageText']?.toString() ?? '',
            subjectId: json['subjectId']?.toString() ?? '',
            questionIds: [json['id']?.toString() ?? ''],
          )
        : null;
    return QuizQuestion(
      id: json['id']?.toString() ?? '',
      subjectId: json['subjectId']?.toString() ?? '',
      unitId: json['unitId']?.toString(),
      lessonId: json['lessonId']?.toString(),
      type: type,
      difficulty: json['difficulty']?.toString() ?? 'MEDIUM',
      questionText: json['questionText']?.toString() ?? '',
      options: Map.unmodifiable(options),
      readingPassage: passage,
      isTrapQuestion: json['isTrapQuestion'] == true,
      answered: json['answered'] == true,
      selectedOptionId: json['selectedOptionId']?.toString(),
      selectedBoolean: json['selectedBoolean'] as bool?,
    );
  }
}

final class QuizAttemptSummary {
  final String id;
  final String scope;
  final String status;
  final String? subjectId;
  final String? unitId;
  final String? lessonId;
  final String? examModelId;
  final int questionCount;
  final int correctCount;
  final int wrongCount;
  final int unansweredCount;
  final double scorePercent;
  final int pointsEarned;
  final int? heartsRemaining;
  final DateTime startedAt;
  final DateTime? completedAt;
  final DateTime? expiresAt;
  final DateTime lastActivityAt;
  final String timingMode;
  final int? durationSeconds;
  final int? timePerQuestionSeconds;
  final String explanationMode;
  final bool hintsEnabled;

  const QuizAttemptSummary({
    required this.id,
    required this.scope,
    required this.status,
    this.subjectId,
    this.unitId,
    this.lessonId,
    this.examModelId,
    required this.questionCount,
    required this.correctCount,
    required this.wrongCount,
    required this.unansweredCount,
    required this.scorePercent,
    required this.pointsEarned,
    this.heartsRemaining,
    required this.startedAt,
    this.completedAt,
    this.expiresAt,
    required this.lastActivityAt,
    required this.timingMode,
    this.durationSeconds,
    this.timePerQuestionSeconds,
    required this.explanationMode,
    required this.hintsEnabled,
  });

  factory QuizAttemptSummary.fromJson(Map<String, dynamic> json) {
    final settings = json['settings'] is Map
        ? Map<String, dynamic>.from(json['settings'] as Map)
        : const <String, dynamic>{};
    DateTime date(Object? value, [DateTime? fallback]) =>
        DateTime.tryParse(value?.toString() ?? '')?.toUtc() ??
        fallback ??
        DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
    return QuizAttemptSummary(
      id: json['id']?.toString() ?? '',
      scope: json['scope']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      subjectId: json['subjectId']?.toString(),
      unitId: json['unitId']?.toString(),
      lessonId: json['lessonId']?.toString(),
      examModelId: json['examModelId']?.toString(),
      questionCount: (json['questionCount'] as num?)?.toInt() ?? 0,
      correctCount: (json['correctCount'] as num?)?.toInt() ?? 0,
      wrongCount: (json['wrongCount'] as num?)?.toInt() ?? 0,
      unansweredCount: (json['unansweredCount'] as num?)?.toInt() ?? 0,
      scorePercent: (json['scorePercent'] as num?)?.toDouble() ?? 0,
      pointsEarned: (json['pointsEarned'] as num?)?.toInt() ?? 0,
      heartsRemaining: (json['heartsRemaining'] as num?)?.toInt(),
      startedAt: date(json['startedAt']),
      completedAt: json['completedAt'] == null
          ? null
          : date(json['completedAt']),
      expiresAt: json['expiresAt'] == null ? null : date(json['expiresAt']),
      lastActivityAt: date(json['lastActivityAt']),
      timingMode: settings['timingMode']?.toString() ?? 'NONE',
      durationSeconds: (settings['durationSeconds'] as num?)?.toInt(),
      timePerQuestionSeconds: (settings['timePerQuestionSeconds'] as num?)
          ?.toInt(),
      explanationMode: settings['explanationMode']?.toString() ?? 'AFTER_EACH',
      hintsEnabled: settings['hintsEnabled'] == true,
    );
  }
}

final class QuizAvailability {
  final int requestedQuestionCount;
  final int actualQuestionCount;
  final int shortageCount;
  final String? warningCode;

  const QuizAvailability({
    required this.requestedQuestionCount,
    required this.actualQuestionCount,
    required this.shortageCount,
    this.warningCode,
  });
  int get selectedCount => actualQuestionCount;
  bool get isPartial => shortageCount > 0;

  factory QuizAvailability.fromJson(Map<String, dynamic> json) =>
      QuizAvailability(
        requestedQuestionCount:
            (json['requestedQuestionCount'] as num?)?.toInt() ?? 0,
        actualQuestionCount:
            (json['actualQuestionCount'] as num?)?.toInt() ?? 0,
        shortageCount: (json['shortageCount'] as num?)?.toInt() ?? 0,
        warningCode: json['warningCode']?.toString(),
      );
}

final class QuizStartResponse {
  final QuizAttemptSummary attempt;
  final List<QuizQuestion> questions;
  final QuizAvailability availability;
  const QuizStartResponse({
    required this.attempt,
    required this.questions,
    required this.availability,
  });

  factory QuizStartResponse.fromJson(Map<String, dynamic> json) {
    final attempt = QuizAttemptSummary.fromJson(
      requireObject(json['attempt'], 'attempt'),
    );
    final questions = requireList(json['questions'])
        .map((item) => QuizQuestion.fromJson(requireObject(item, 'question')))
        .toList(growable: false);
    final availabilityJson = json['availability'];
    return QuizStartResponse(
      attempt: attempt,
      questions: questions,
      availability: availabilityJson is Map
          ? QuizAvailability.fromJson(
              Map<String, dynamic>.from(availabilityJson),
            )
          : QuizAvailability(
              requestedQuestionCount: attempt.questionCount,
              actualQuestionCount: questions.length,
              shortageCount: (attempt.questionCount - questions.length).clamp(
                0,
                attempt.questionCount,
              ),
            ),
    );
  }
}

final class QuizAnswerResponse {
  final bool accepted;
  final bool? isCorrect;
  final String? correctOptionId;
  final bool? correctBoolean;
  final String? explanationShort;
  final String? explanationDetailed;
  final int pointsEarned;
  final int attemptPoints;
  final int answered;
  final int remaining;
  final int correct;
  final int wrong;
  final int? heartsRemaining;
  final String status;

  const QuizAnswerResponse({
    required this.accepted,
    this.isCorrect,
    this.correctOptionId,
    this.correctBoolean,
    this.explanationShort,
    this.explanationDetailed,
    required this.pointsEarned,
    required this.attemptPoints,
    required this.answered,
    required this.remaining,
    required this.correct,
    required this.wrong,
    this.heartsRemaining,
    required this.status,
  });

  factory QuizAnswerResponse.fromJson(Map<String, dynamic> json) {
    final answer = json['correctAnswer'] is Map
        ? Map<String, dynamic>.from(json['correctAnswer'] as Map)
        : const <String, dynamic>{};
    final explanation = json['explanation'] is Map
        ? Map<String, dynamic>.from(json['explanation'] as Map)
        : const <String, dynamic>{};
    final score = requireObject(json['score'], 'score');
    final progress = requireObject(json['progress'], 'progress');
    return QuizAnswerResponse(
      accepted: json['accepted'] == true,
      isCorrect: json['isCorrect'] as bool?,
      correctOptionId: answer['optionId']?.toString(),
      correctBoolean: answer['value'] as bool?,
      explanationShort: explanation['short']?.toString(),
      explanationDetailed: explanation['detailed']?.toString(),
      pointsEarned: (score['pointsEarned'] as num?)?.toInt() ?? 0,
      attemptPoints: (score['attemptPoints'] as num?)?.toInt() ?? 0,
      answered: (progress['answered'] as num?)?.toInt() ?? 0,
      remaining: (progress['remaining'] as num?)?.toInt() ?? 0,
      correct: (progress['correct'] as num?)?.toInt() ?? 0,
      wrong: (progress['wrong'] as num?)?.toInt() ?? 0,
      heartsRemaining: (progress['heartsRemaining'] as num?)?.toInt(),
      status: progress['status']?.toString() ?? '',
    );
  }
}

final class QuizBreakdownEntry {
  final String key;
  final int answered;
  final int correct;
  final int wrong;

  const QuizBreakdownEntry({
    required this.key,
    required this.answered,
    required this.correct,
    required this.wrong,
  });

  factory QuizBreakdownEntry.fromJson(Map<String, dynamic> json) {
    final correct = (json['correct'] as num?)?.toInt() ?? 0;
    final wrong = (json['wrong'] as num?)?.toInt() ?? 0;
    return QuizBreakdownEntry(
      key: json['key']?.toString() ?? json['id']?.toString() ?? '',
      answered: (json['answered'] as num?)?.toInt() ?? correct + wrong,
      correct: correct,
      wrong: wrong,
    );
  }
}

final class QuizBreakdowns {
  final List<QuizBreakdownEntry> subjects;
  final List<QuizBreakdownEntry> units;
  final List<QuizBreakdownEntry> lessons;
  final List<QuizBreakdownEntry> difficulties;
  final List<QuizBreakdownEntry> questionTypes;

  const QuizBreakdowns({
    required this.subjects,
    required this.units,
    required this.lessons,
    required this.difficulties,
    required this.questionTypes,
  });

  factory QuizBreakdowns.fromJson(Map<String, dynamic> json) {
    List<QuizBreakdownEntry> entries(Object? value) => value is List
        ? value
              .map((item) => QuizBreakdownEntry.fromJson(requireObject(item)))
              .toList(growable: false)
        : const [];
    return QuizBreakdowns(
      subjects: entries(json['subject']),
      units: entries(json['unit']),
      lessons: entries(json['lesson']),
      difficulties: entries(json['difficulty']),
      questionTypes: entries(json['questionType']),
    );
  }
}

final class QuizSlowQuestion {
  final String questionId;
  final int timeSpentMs;
  const QuizSlowQuestion(this.questionId, this.timeSpentMs);

  factory QuizSlowQuestion.fromJson(Map<String, dynamic> json) =>
      QuizSlowQuestion(
        json['questionId']?.toString() ?? '',
        (json['timeSpentMs'] as num?)?.toInt() ?? 0,
      );
}

final class QuizResultQuestion {
  final QuizQuestion question;
  final bool answered;
  final String? selectedOptionId;
  final bool? selectedBoolean;
  final bool? isCorrect;
  final String? correctOptionId;
  final bool? correctBoolean;
  final int pointsEarned;
  final int? timeSpentMs;

  const QuizResultQuestion({
    required this.question,
    required this.answered,
    this.selectedOptionId,
    this.selectedBoolean,
    this.isCorrect,
    this.correctOptionId,
    this.correctBoolean,
    required this.pointsEarned,
    this.timeSpentMs,
  });

  factory QuizResultQuestion.fromJson(Map<String, dynamic> json) {
    String? correctOptionId;
    final options = json['options'];
    if (options is List) {
      for (final option in options) {
        if (option is Map && option['isCorrect'] == true) {
          correctOptionId = option['id']?.toString();
          break;
        }
      }
    }
    return QuizResultQuestion(
      question: QuizQuestion.fromJson(json),
      answered: json['answered'] == true,
      selectedOptionId: json['selectedOptionId']?.toString(),
      selectedBoolean: json['selectedBoolean'] as bool?,
      isCorrect: json['isCorrect'] as bool?,
      correctOptionId: correctOptionId,
      correctBoolean: json['correctBoolean'] as bool?,
      pointsEarned: (json['pointsEarned'] as num?)?.toInt() ?? 0,
      timeSpentMs: (json['timeSpentMs'] as num?)?.toInt(),
    );
  }
}

final class QuizResult {
  final QuizAttemptSummary summary;
  final int answeredCount;
  final int durationSeconds;
  final QuizBreakdowns breakdowns;
  final List<String> strengths;
  final List<String> weaknesses;
  final List<QuizSlowQuestion> slowQuestions;
  final List<QuizResultQuestion> wrongQuestions;
  final List<QuizQuestion> unansweredQuestions;
  final List<String> recommendedLessonIds;
  final List<QuizResultQuestion> questions;
  final int pointsEarned;
  final List<String> achievementsUnlocked;

  const QuizResult({
    required this.summary,
    required this.answeredCount,
    required this.durationSeconds,
    required this.breakdowns,
    required this.strengths,
    required this.weaknesses,
    required this.slowQuestions,
    required this.wrongQuestions,
    required this.unansweredQuestions,
    required this.recommendedLessonIds,
    required this.questions,
    required this.pointsEarned,
    required this.achievementsUnlocked,
  });

  factory QuizResult.fromJson(Map<String, dynamic> json) {
    final summaryJson = requireObject(json['summary'], 'summary');
    final analysis = requireObject(json['analysis'], 'analysis');
    final gamification = requireObject(json['gamification'], 'gamification');
    List<String> strings(Object? value) => value is List
        ? value.map((item) => item.toString()).toList(growable: false)
        : const [];
    List<T> objects<T>(Object? value, T Function(Map<String, dynamic>) parse) =>
        value is List
        ? value
              .map((item) => parse(requireObject(item)))
              .toList(growable: false)
        : const [];
    String achievementKey(Object? item) {
      if (item is Map) {
        return item['key']?.toString() ??
            item['code']?.toString() ??
            item['id']?.toString() ??
            '';
      }
      return item?.toString() ?? '';
    }

    return QuizResult(
      summary: QuizAttemptSummary.fromJson(summaryJson),
      answeredCount: (summaryJson['answeredCount'] as num?)?.toInt() ?? 0,
      durationSeconds: (summaryJson['durationSeconds'] as num?)?.toInt() ?? 0,
      breakdowns: QuizBreakdowns.fromJson(
        requireObject(json['breakdowns'], 'breakdowns'),
      ),
      strengths: strings(analysis['strengths']),
      weaknesses: strings(analysis['weaknesses']),
      slowQuestions: objects(
        analysis['slowQuestions'],
        QuizSlowQuestion.fromJson,
      ),
      wrongQuestions: objects(
        analysis['wrongQuestions'],
        QuizResultQuestion.fromJson,
      ),
      unansweredQuestions: objects(
        analysis['unansweredQuestions'],
        QuizQuestion.fromJson,
      ),
      recommendedLessonIds: strings(analysis['recommendedLessons']),
      questions: objects(json['questions'], QuizResultQuestion.fromJson),
      pointsEarned: (gamification['points'] as num?)?.toInt() ?? 0,
      achievementsUnlocked: gamification['achievementsUnlocked'] is List
          ? (gamification['achievementsUnlocked'] as List)
                .map(achievementKey)
                .where((key) => key.isNotEmpty)
                .toList(growable: false)
          : const [],
    );
  }
}

final class QuizHistoryPage {
  final List<QuizAttemptSummary> items;
  final PageMeta meta;
  const QuizHistoryPage(this.items, this.meta);
}
