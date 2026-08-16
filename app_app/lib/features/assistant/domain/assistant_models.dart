enum AssistantAction {
  chat,
  hint,
  explain,
  reviewAnswer,
  summarizeLesson,
  simplifyLesson,
  askKnowledge,
  analyzeImage,
}

final class AssistantSourceReference {
  final String documentId;
  final int? pageNumber;
  final String title;

  const AssistantSourceReference({
    required this.documentId,
    required this.pageNumber,
    required this.title,
  });

  factory AssistantSourceReference.fromJson(Map<String, dynamic> json) =>
      AssistantSourceReference(
        documentId: json['documentId']?.toString() ?? '',
        pageNumber: (json['pageNumber'] as num?)?.toInt(),
        title: json['title']?.toString() ?? '',
      );
}

final class AssistantUsageInfo {
  final bool enabled;
  final int limit;
  final int used;
  final int? remaining;
  final String resetPeriod;
  final String? resetAt;
  final String? limitMessage;

  const AssistantUsageInfo({
    required this.enabled,
    required this.limit,
    required this.used,
    required this.remaining,
    required this.resetPeriod,
    this.resetAt,
    this.limitMessage,
  });

  bool get isUnlimited => limit == 0;
  bool get isLimitReached => !isUnlimited && (remaining != null && remaining! <= 0);

  factory AssistantUsageInfo.fromJson(Map<String, dynamic> json) => AssistantUsageInfo(
    enabled: json['enabled'] as bool? ?? false,
    limit: (json['limit'] as num?)?.toInt() ?? 0,
    used: (json['used'] as num?)?.toInt() ?? 0,
    remaining: (json['remaining'] as num?)?.toInt(),
    resetPeriod: json['resetPeriod']?.toString() ?? 'DAILY',
    resetAt: json['resetAt']?.toString(),
    limitMessage: json['limitMessage']?.toString(),
  );

  AssistantUsageInfo copyWith({
    bool? enabled,
    int? limit,
    int? used,
    int? remaining,
    String? resetPeriod,
    String? resetAt,
    String? limitMessage,
  }) =>
      AssistantUsageInfo(
        enabled: enabled ?? this.enabled,
        limit: limit ?? this.limit,
        used: used ?? this.used,
        remaining: remaining ?? this.remaining,
        resetPeriod: resetPeriod ?? this.resetPeriod,
        resetAt: resetAt ?? this.resetAt,
        limitMessage: limitMessage ?? this.limitMessage,
      );
}

final class AssistantResponse {
  final String requestId;
  final bool hasSufficientContext;
  final String summary;
  final List<String> steps;
  final String? keyConcept;
  final String? commonMistake;
  final List<AssistantSourceReference> sources;
  final int? remainingToday;
  final int? remaining;
  final int? used;
  final int? limit;
  final String? resetPeriod;
  final String? resetAt;

  const AssistantResponse({
    required this.requestId,
    required this.hasSufficientContext,
    required this.summary,
    required this.steps,
    required this.keyConcept,
    required this.commonMistake,
    required this.sources,
    required this.remainingToday,
    this.remaining,
    this.used,
    this.limit,
    this.resetPeriod,
    this.resetAt,
  });

  factory AssistantResponse.fromJson(Map<String, dynamic> json) {
    final usage = json['usage'] is Map
        ? Map<String, dynamic>.from(json['usage'] as Map)
        : const <String, dynamic>{};
    final rawSources = json['sourceReferences'] is List
        ? json['sourceReferences'] as List
        : const [];
    return AssistantResponse(
      requestId: json['requestId']?.toString() ?? '',
      hasSufficientContext: json['status'] != 'INSUFFICIENT_CONTEXT',
      summary: json['summary']?.toString() ?? '',
      steps: (json['steps'] is List ? json['steps'] as List : const [])
          .map((item) => item.toString())
          .where((item) => item.trim().isNotEmpty)
          .toList(growable: false),
      keyConcept: _optionalString(json['keyConcept']),
      commonMistake: _optionalString(json['commonMistake']),
      sources: rawSources
          .whereType<Map>()
          .map(
            (item) => AssistantSourceReference.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList(growable: false),
      remainingToday: (usage['remainingToday'] as num?)?.toInt(),
      remaining: (usage['remaining'] as num?)?.toInt(),
      used: (usage['used'] as num?)?.toInt(),
      limit: (usage['limit'] as num?)?.toInt(),
      resetPeriod: usage['resetPeriod']?.toString(),
      resetAt: usage['resetAt']?.toString(),
    );
  }

  static String? _optionalString(Object? value) {
    final text = value?.toString().trim();
    return text == null || text.isEmpty ? null : text;
  }
}

enum ImageAnalysisMode { extractOnly, explain, solve, checkMyAnswer }

extension ImageAnalysisModeWire on ImageAnalysisMode {
  String get wireName => switch (this) {
    ImageAnalysisMode.extractOnly => 'EXTRACT_ONLY',
    ImageAnalysisMode.explain => 'EXPLAIN',
    ImageAnalysisMode.solve => 'SOLVE',
    ImageAnalysisMode.checkMyAnswer => 'CHECK_MY_ANSWER',
  };
}

final class ImageQuestionAnalysisResponse {
  final String requestId;
  final String detectedText;
  final String normalizedQuestion;
  final List<String> detectedOptions;
  final String? detectedSubject;
  final String? detectedTopic;
  final ImageAnalysisMode analysisMode;
  final String? explanation;
  final List<String> solutionSteps;
  final String? finalAnswer;
  final double confidence;
  final bool requiresClarification;
  final List<String> warnings;
  final String? matchedQuestionId;
  final int? remainingToday;

  const ImageQuestionAnalysisResponse({
    required this.requestId,
    required this.detectedText,
    required this.normalizedQuestion,
    required this.detectedOptions,
    required this.detectedSubject,
    required this.detectedTopic,
    required this.analysisMode,
    required this.explanation,
    required this.solutionSteps,
    required this.finalAnswer,
    required this.confidence,
    required this.requiresClarification,
    required this.warnings,
    required this.matchedQuestionId,
    required this.remainingToday,
  });

  factory ImageQuestionAnalysisResponse.fromJson(Map<String, dynamic> json) {
    final usage = json['usageStatus'] is Map
        ? Map<String, dynamic>.from(json['usageStatus'] as Map)
        : const <String, dynamic>{};
    return ImageQuestionAnalysisResponse(
      requestId: json['requestId']?.toString() ?? '',
      detectedText: json['detectedText']?.toString() ?? '',
      normalizedQuestion: json['normalizedQuestion']?.toString() ?? '',
      detectedOptions: _stringList(json['detectedOptions']),
      detectedSubject: _optional(json['detectedSubject']),
      detectedTopic: _optional(json['detectedTopic']),
      analysisMode: ImageAnalysisMode.values.firstWhere(
        (mode) => mode.wireName == json['analysisMode'],
        orElse: () => ImageAnalysisMode.explain,
      ),
      explanation: _optional(json['explanation']),
      solutionSteps: _stringList(json['solutionSteps']),
      finalAnswer: _optional(json['finalAnswer']),
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0,
      requiresClarification: json['requiresClarification'] == true,
      warnings: _stringList(json['warnings']),
      matchedQuestionId: _optional(json['matchedQuestionId']),
      remainingToday: (usage['remainingToday'] as num?)?.toInt(),
    );
  }

  static List<String> _stringList(Object? value) => value is List
      ? value.map((item) => item.toString()).toList(growable: false)
      : const [];

  static String? _optional(Object? value) {
    final text = value?.toString().trim();
    return text == null || text.isEmpty ? null : text;
  }
}
