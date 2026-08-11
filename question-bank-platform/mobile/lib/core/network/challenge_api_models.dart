import 'api_response.dart';

enum ChallengeMode {
  oneVsOne('ONE_VS_ONE'),
  twoVsTwo('TWO_VS_TWO'),
  lightning('LIGHTNING'),
  survival('SURVIVAL');

  final String apiValue;
  const ChallengeMode(this.apiValue);
  factory ChallengeMode.fromApi(Object? value) => values.firstWhere(
    (mode) => mode.apiValue == value?.toString(),
    orElse: () => ChallengeMode.oneVsOne,
  );
}

final class ChallengeModeInfo {
  final ChallengeMode mode;
  final int minPlayers;
  final int maxPlayers;
  final String description;
  const ChallengeModeInfo({
    required this.mode,
    required this.minPlayers,
    required this.maxPlayers,
    required this.description,
  });
  factory ChallengeModeInfo.fromJson(Map<String, dynamic> json) =>
      ChallengeModeInfo(
        mode: ChallengeMode.fromApi(json['mode']),
        minPlayers: (json['minPlayers'] as num?)?.toInt() ?? 0,
        maxPlayers: (json['maxPlayers'] as num?)?.toInt() ?? 0,
        description: json['description']?.toString() ?? '',
      );
}

final class ChallengeUser {
  final String id;
  final String name;
  final String? schoolName;
  const ChallengeUser({required this.id, required this.name, this.schoolName});
  factory ChallengeUser.fromJson(Map<String, dynamic> json) => ChallengeUser(
    id: json['id']?.toString() ?? '',
    name: json['name']?.toString() ?? '',
    schoolName: json['schoolName']?.toString(),
  );
}

final class ChallengeParticipant {
  final String id;
  final String userId;
  final String status;
  final int score;
  final int correctAnswers;
  final int wrongAnswers;
  final int? heartsRemaining;
  final int? team;
  final int? rank;
  final ChallengeUser? user;
  const ChallengeParticipant({
    required this.id,
    required this.userId,
    required this.status,
    required this.score,
    required this.correctAnswers,
    required this.wrongAnswers,
    this.heartsRemaining,
    this.team,
    this.rank,
    this.user,
  });
  factory ChallengeParticipant.fromJson(Map<String, dynamic> json) {
    final rawUser = json['user'];
    return ChallengeParticipant(
      id: json['id']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      score: (json['score'] as num?)?.toInt() ?? 0,
      correctAnswers: (json['correctAnswers'] as num?)?.toInt() ?? 0,
      wrongAnswers: (json['wrongAnswers'] as num?)?.toInt() ?? 0,
      heartsRemaining: (json['heartsRemaining'] as num?)?.toInt(),
      team: (json['team'] as num?)?.toInt(),
      rank: (json['rank'] as num?)?.toInt(),
      user: rawUser is Map
          ? ChallengeUser.fromJson(Map<String, dynamic>.from(rawUser))
          : null,
    );
  }
}

final class ChallengeQuestion {
  final String id;
  final int sortOrder;
  final String type;
  final String questionText;
  final Map<String, String> options;
  const ChallengeQuestion({
    required this.id,
    required this.sortOrder,
    required this.type,
    required this.questionText,
    required this.options,
  });
  factory ChallengeQuestion.fromJson(Map<String, dynamic> json) {
    final wrapper = json['question'] is Map
        ? Map<String, dynamic>.from(json['question'] as Map)
        : json;
    final rawOptions = wrapper['options'] is List
        ? wrapper['options'] as List
        : const [];
    return ChallengeQuestion(
      id: wrapper['id']?.toString() ?? '',
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
      type: wrapper['type']?.toString() ?? 'MULTIPLE_CHOICE',
      questionText: wrapper['questionText']?.toString() ?? '',
      options: Map.unmodifiable({
        for (final option in rawOptions)
          if (option is Map && option['id'] != null)
            option['id'].toString(): option['optionText']?.toString() ?? '',
      }),
    );
  }
}

final class Challenge {
  final String id;
  final ChallengeMode mode;
  final String status;
  final String? subjectId;
  final int questionCount;
  final int timePerQuestionSeconds;
  final int maxPlayers;
  final String? winnerUserId;
  final int? winnerTeam;
  final DateTime? startedAt;
  final DateTime? completedAt;
  final int? currentSortOrder;
  final List<ChallengeParticipant> participants;
  final List<ChallengeQuestion> questions;
  const Challenge({
    required this.id,
    required this.mode,
    required this.status,
    this.subjectId,
    required this.questionCount,
    required this.timePerQuestionSeconds,
    required this.maxPlayers,
    this.winnerUserId,
    this.winnerTeam,
    this.startedAt,
    this.completedAt,
    this.currentSortOrder,
    this.participants = const [],
    this.questions = const [],
  });
  factory Challenge.fromJson(Map<String, dynamic> json) {
    DateTime? date(Object? value) =>
        DateTime.tryParse(value?.toString() ?? '')?.toUtc();
    return Challenge(
      id: json['id']?.toString() ?? json['challengeId']?.toString() ?? '',
      mode: ChallengeMode.fromApi(json['mode']),
      status: json['status']?.toString() ?? '',
      subjectId: json['subjectId']?.toString(),
      questionCount: (json['questionCount'] as num?)?.toInt() ?? 0,
      timePerQuestionSeconds:
          (json['timePerQuestionSeconds'] as num?)?.toInt() ?? 0,
      maxPlayers: (json['maxPlayers'] as num?)?.toInt() ?? 0,
      winnerUserId: json['winnerUserId']?.toString(),
      winnerTeam: (json['winnerTeam'] as num?)?.toInt(),
      startedAt: date(json['startedAt']),
      completedAt: date(json['completedAt']),
      currentSortOrder: (json['currentSortOrder'] as num?)?.toInt(),
      participants: _objects(
        json['participants'],
      ).map(ChallengeParticipant.fromJson).toList(growable: false),
      questions: _objects(
        json['questions'],
      ).map(ChallengeQuestion.fromJson).toList(growable: false),
    );
  }
}

final class ChallengeResult {
  final String challengeId;
  final String? winnerUserId;
  final int? winnerTeam;
  final DateTime? completedAt;
  final List<ChallengeParticipant> standings;
  const ChallengeResult({
    required this.challengeId,
    this.winnerUserId,
    this.winnerTeam,
    this.completedAt,
    required this.standings,
  });
  factory ChallengeResult.fromJson(Map<String, dynamic> json) =>
      ChallengeResult(
        challengeId: json['challengeId']?.toString() ?? '',
        winnerUserId: json['winnerUserId']?.toString(),
        winnerTeam: (json['winnerTeam'] as num?)?.toInt(),
        completedAt: DateTime.tryParse(
          json['completedAt']?.toString() ?? '',
        )?.toUtc(),
        standings: _objects(
          json['standings'],
        ).map(ChallengeParticipant.fromJson).toList(growable: false),
      );
}

final class ChallengeRoundResult {
  final bool isCorrect;
  final int pointsEarned;
  final int totalScore;
  final int? heartsRemaining;
  final int responseTimeMs;
  final bool challengeCompleted;
  final int currentSortOrder;
  final DateTime? roundEndsAt;
  const ChallengeRoundResult({
    required this.isCorrect,
    required this.pointsEarned,
    required this.totalScore,
    this.heartsRemaining,
    required this.responseTimeMs,
    required this.challengeCompleted,
    required this.currentSortOrder,
    this.roundEndsAt,
  });
  factory ChallengeRoundResult.fromJson(Map<String, dynamic> json) =>
      ChallengeRoundResult(
        isCorrect: json['isCorrect'] == true,
        pointsEarned: (json['pointsEarned'] as num?)?.toInt() ?? 0,
        totalScore: (json['totalScore'] as num?)?.toInt() ?? 0,
        heartsRemaining: (json['heartsRemaining'] as num?)?.toInt(),
        responseTimeMs: (json['responseTimeMs'] as num?)?.toInt() ?? 0,
        challengeCompleted: json['challengeCompleted'] == true,
        currentSortOrder: (json['currentSortOrder'] as num?)?.toInt() ?? 0,
        roundEndsAt: DateTime.tryParse(
          json['roundEndsAt']?.toString() ?? '',
        )?.toUtc(),
      );
}

final class ChallengePage {
  final List<Challenge> items;
  final PageMeta meta;
  const ChallengePage(this.items, this.meta);
}

List<Map<String, dynamic>> _objects(Object? value) => value is List
    ? value
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList(growable: false)
    : const [];
