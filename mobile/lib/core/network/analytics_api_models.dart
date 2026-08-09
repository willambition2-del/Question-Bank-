import '../models/achievement_model.dart';
import '../models/daily_task_model.dart';
import '../models/leaderboard_entry.dart';
import 'api_response.dart';

final class StatisticsOverview {
  final int totalAnswered;
  final int totalQuestions;
  final int totalAvailableQuestions;
  final int totalCorrect;
  final int totalWrong;
  final double accuracyPercent;
  final int completedQuizzes;
  final double averageQuizScore;
  final int averageAnswerTimeMs;
  final int studyTimeSeconds;
  final double masteryPercent;
  final int currentStreakDays;
  final int bestStreakDays;
  final int totalPoints;
  final int level;
  final int? rank;

  const StatisticsOverview({
    required this.totalAnswered,
    required this.totalQuestions,
    required this.totalAvailableQuestions,
    required this.totalCorrect,
    required this.totalWrong,
    required this.accuracyPercent,
    required this.completedQuizzes,
    required this.averageQuizScore,
    required this.averageAnswerTimeMs,
    required this.studyTimeSeconds,
    required this.masteryPercent,
    required this.currentStreakDays,
    required this.bestStreakDays,
    required this.totalPoints,
    required this.level,
    this.rank,
  });

  factory StatisticsOverview.fromJson(Map<String, dynamic> json) =>
      StatisticsOverview(
        totalAnswered: _int(json['totalAnswered']),
        totalQuestions: _int(json['totalQuestions']),
        totalAvailableQuestions: _int(json['totalAvailableQuestions']),
        totalCorrect: _int(json['totalCorrect']),
        totalWrong: _int(json['totalWrong']),
        accuracyPercent: _double(json['accuracyPercent']),
        completedQuizzes: _int(json['completedQuizzes']),
        averageQuizScore: _double(json['averageQuizScore']),
        averageAnswerTimeMs: _int(json['averageAnswerTimeMs']),
        studyTimeSeconds: _int(json['studyTimeSeconds']),
        masteryPercent: _double(json['masteryPercent']),
        currentStreakDays: _int(json['currentStreakDays']),
        bestStreakDays: _int(json['bestStreakDays']),
        totalPoints: _int(json['totalPoints']),
        level: _int(json['level'], 1),
        rank: json['rank'] == null ? null : _int(json['rank']),
      );
}

final class ActivityPoint {
  final DateTime date;
  final int answeredQuestions;
  final int correctAnswers;
  final int wrongAnswers;
  final int quizzesCompleted;
  final int challengesPlayed;
  final int pointsEarned;
  final int studyTimeSeconds;

  const ActivityPoint({
    required this.date,
    required this.answeredQuestions,
    required this.correctAnswers,
    required this.wrongAnswers,
    required this.quizzesCompleted,
    required this.challengesPlayed,
    required this.pointsEarned,
    required this.studyTimeSeconds,
  });

  factory ActivityPoint.fromJson(Map<String, dynamic> json) => ActivityPoint(
    date: _date(json['date']),
    answeredQuestions: _int(json['answeredQuestions']),
    correctAnswers: _int(json['correctAnswers']),
    wrongAnswers: _int(json['wrongAnswers']),
    quizzesCompleted: _int(json['quizzesCompleted']),
    challengesPlayed: _int(json['challengesPlayed']),
    pointsEarned: _int(json['pointsEarned']),
    studyTimeSeconds: _int(json['studyTimeSeconds']),
  );
}

final class AccuracyTrendPoint {
  final DateTime date;
  final int answeredCount;
  final double accuracyPercent;
  const AccuracyTrendPoint(this.date, this.answeredCount, this.accuracyPercent);

  factory AccuracyTrendPoint.fromJson(Map<String, dynamic> json) =>
      AccuracyTrendPoint(
        _date(json['date']),
        _int(json['answeredCount']),
        _double(json['accuracyPercent']),
      );
}

final class HeatmapPoint {
  final DateTime date;
  final int answeredCount;
  final int correctCount;
  final int activityLevel;
  const HeatmapPoint({
    required this.date,
    required this.answeredCount,
    required this.correctCount,
    required this.activityLevel,
  });

  factory HeatmapPoint.fromJson(Map<String, dynamic> json) => HeatmapPoint(
    date: _date(json['date']),
    answeredCount: _int(json['answeredCount']),
    correctCount: _int(json['correctCount']),
    activityLevel: _int(json['activityLevel']),
  );
}

final class ProgressMetric {
  final String id;
  final String name;
  final double accuracy;
  final double mastery;
  final int questionsAnswered;
  final int mistakes;

  const ProgressMetric({
    required this.id,
    required this.name,
    required this.accuracy,
    required this.mastery,
    required this.questionsAnswered,
    required this.mistakes,
  });

  factory ProgressMetric.fromJson(Map<String, dynamic> json) => ProgressMetric(
    id: json['id']?.toString() ?? '',
    name: json['name']?.toString() ?? '',
    accuracy: _double(json['accuracy']),
    mastery: _double(json['mastery']),
    questionsAnswered: _int(json['questionsAnswered']),
    mistakes: _int(json['mistakes']),
  );
}

final class QuestionAnalytics {
  final Map<String, int> difficultyDistribution;
  final int averageAnswerTimeMs;
  const QuestionAnalytics(
    this.difficultyDistribution,
    this.averageAnswerTimeMs,
  );

  factory QuestionAnalytics.fromJson(Map<String, dynamic> json) {
    final raw = json['difficultyDistribution'];
    return QuestionAnalytics(
      raw is Map
          ? Map.unmodifiable({
              for (final entry in raw.entries)
                entry.key.toString(): _int(entry.value),
            })
          : const {},
      _int(json['averageAnswerTimeMs']),
    );
  }
}

final class TimeDistributionBucket {
  final String key;
  final int count;
  const TimeDistributionBucket(this.key, this.count);

  factory TimeDistributionBucket.fromJson(Map<String, dynamic> json) =>
      TimeDistributionBucket(
        json['key']?.toString() ?? '',
        _int(json['count']),
      );
}

final class PointTransaction {
  final String id;
  final int amount;
  final String type;
  final String? description;
  final DateTime createdAt;
  const PointTransaction({
    required this.id,
    required this.amount,
    required this.type,
    this.description,
    required this.createdAt,
  });

  factory PointTransaction.fromJson(Map<String, dynamic> json) =>
      PointTransaction(
        id: json['id']?.toString() ?? '',
        amount: _int(json['amount']),
        type: json['type']?.toString() ?? '',
        description: json['description']?.toString(),
        createdAt: _date(json['createdAt']),
      );
}

final class PointHistoryPage {
  final List<PointTransaction> items;
  final PageMeta meta;
  const PointHistoryPage(this.items, this.meta);
}

final class RecommendationWeakness {
  final double score;
  final String reason;
  final String questionId;
  final String questionText;
  final String subjectName;
  final String? lessonId;
  final double masteryPercent;
  final int wrongCount;

  const RecommendationWeakness({
    required this.score,
    required this.reason,
    required this.questionId,
    required this.questionText,
    required this.subjectName,
    this.lessonId,
    required this.masteryPercent,
    required this.wrongCount,
  });

  factory RecommendationWeakness.fromJson(Map<String, dynamic> json) {
    final question = requireObject(json['question'], 'question');
    return RecommendationWeakness(
      score: _double(json['score']),
      reason: json['reason']?.toString() ?? '',
      questionId: question['id']?.toString() ?? '',
      questionText: question['questionText']?.toString() ?? '',
      subjectName: question['subjectName']?.toString() ?? '',
      lessonId: question['lessonId']?.toString(),
      masteryPercent: _double(json['masteryPercent']),
      wrongCount: _int(json['wrongCount']),
    );
  }
}

final class RecommendationLesson {
  final double score;
  final String reason;
  final String id;
  final String name;
  final String subjectId;
  final String subjectName;
  final String unitId;
  final int availableQuestions;
  final double masteryPercent;
  final double accuracyPercent;

  const RecommendationLesson({
    required this.score,
    required this.reason,
    required this.id,
    required this.name,
    required this.subjectId,
    required this.subjectName,
    required this.unitId,
    required this.availableQuestions,
    required this.masteryPercent,
    required this.accuracyPercent,
  });

  factory RecommendationLesson.fromJson(Map<String, dynamic> json) {
    final lesson = requireObject(json['lesson'], 'lesson');
    return RecommendationLesson(
      score: _double(json['score']),
      reason: json['reason']?.toString() ?? '',
      id: lesson['id']?.toString() ?? '',
      name: lesson['name']?.toString() ?? '',
      subjectId: lesson['subjectId']?.toString() ?? '',
      subjectName: lesson['subjectName']?.toString() ?? '',
      unitId: lesson['unitId']?.toString() ?? '',
      availableQuestions: _int(lesson['availableQuestions']),
      masteryPercent: _double(json['masteryPercent']),
      accuracyPercent: _double(json['accuracyPercent']),
    );
  }
}

final class RecommendationBundle {
  final DateTime generatedAt;
  final List<RecommendationWeakness> weaknesses;
  final List<RecommendationLesson> lessons;
  const RecommendationBundle(this.generatedAt, this.weaknesses, this.lessons);

  factory RecommendationBundle.fromJson(Map<String, dynamic> json) =>
      RecommendationBundle(
        _date(json['generatedAt']),
        _objects(json['weaknesses'], RecommendationWeakness.fromJson),
        _objects(json['lessons'], RecommendationLesson.fromJson),
      );
}

final class PointsProfile {
  final int currentLevel;
  final int currentPoints;
  final int currentLevelMinimum;
  final int? nextLevelMinimum;
  final double progressPercent;
  const PointsProfile({
    required this.currentLevel,
    required this.currentPoints,
    required this.currentLevelMinimum,
    this.nextLevelMinimum,
    required this.progressPercent,
  });

  factory PointsProfile.fromJson(Map<String, dynamic> json) => PointsProfile(
    currentLevel: _int(json['currentLevel'], 1),
    currentPoints: _int(json['currentPoints']),
    currentLevelMinimum: _int(json['currentLevelMinimum']),
    nextLevelMinimum: json['nextLevelMinimum'] == null
        ? null
        : _int(json['nextLevelMinimum']),
    progressPercent: _double(json['progressPercent']),
  );
}

final class DailyTask {
  final String id;
  final String key;
  final String title;
  final String description;
  final int progress;
  final int targetValue;
  final int pointsReward;
  final bool isCompleted;
  final bool rewardClaimed;

  const DailyTask({
    required this.id,
    required this.key,
    required this.title,
    required this.description,
    required this.progress,
    required this.targetValue,
    required this.pointsReward,
    required this.isCompleted,
    required this.rewardClaimed,
  });

  factory DailyTask.fromJson(Map<String, dynamic> json) {
    final definition = requireObject(json['taskDefinition'], 'taskDefinition');
    return DailyTask(
      id: json['id']?.toString() ?? '',
      key: definition['key']?.toString() ?? '',
      title: definition['title']?.toString() ?? '',
      description: definition['description']?.toString() ?? '',
      progress: _int(json['progress']),
      targetValue: _int(json['targetValue']),
      pointsReward: _int(definition['pointsReward']),
      isCompleted: json['isCompleted'] == true,
      rewardClaimed: json['rewardClaimedAt'] != null,
    );
  }

  DailyTaskModel toLegacy() => DailyTaskModel(
    id: id,
    description: description,
    targetCount: targetValue,
    currentCount: progress,
    rewardPoints: pointsReward,
    isCompleted: isCompleted,
  );
}

final class AchievementApiModel {
  final String id;
  final String key;
  final String name;
  final String description;
  final String iconKey;
  final String category;
  final int conditionValue;
  final int pointsReward;
  final bool unlocked;
  final DateTime? unlockedAt;
  final bool isSeen;

  const AchievementApiModel({
    required this.id,
    required this.key,
    required this.name,
    required this.description,
    required this.iconKey,
    required this.category,
    required this.conditionValue,
    required this.pointsReward,
    required this.unlocked,
    this.unlockedAt,
    required this.isSeen,
  });

  factory AchievementApiModel.fromJson(Map<String, dynamic> json) =>
      AchievementApiModel(
        id: json['id']?.toString() ?? '',
        key: json['key']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        description: json['description']?.toString() ?? '',
        iconKey: json['iconKey']?.toString() ?? 'default',
        category: json['category']?.toString() ?? 'GENERAL',
        conditionValue: _int(json['conditionValue']),
        pointsReward: _int(json['pointsReward']),
        unlocked: json['unlocked'] == true,
        unlockedAt: _nullableDate(json['unlockedAt']),
        isSeen: json['isSeen'] == true,
      );

  AchievementModel toLegacy() => AchievementModel(
    id: id,
    title: name,
    description: description,
    badgeIcon: iconKey,
    isUnlocked: unlocked,
    unlockedAt: unlockedAt?.toIso8601String(),
    progress: unlocked ? 1 : 0,
    rewardPoints: pointsReward,
    rarity: category.toLowerCase(),
  );
}

final class LeaderboardPlayer {
  final int rank;
  final String userId;
  final String displayName;
  final String? schoolName;
  final int points;
  final int level;
  final String companion;
  final double accuracyPercent;

  const LeaderboardPlayer({
    required this.rank,
    required this.userId,
    required this.displayName,
    this.schoolName,
    required this.points,
    required this.level,
    required this.companion,
    required this.accuracyPercent,
  });

  factory LeaderboardPlayer.fromJson(Map<String, dynamic> json) =>
      LeaderboardPlayer(
        rank: _int(json['rank']),
        userId: json['userId']?.toString() ?? '',
        displayName: json['displayName']?.toString() ?? '',
        schoolName: json['schoolName']?.toString(),
        points: _int(json['points']),
        level: _int(json['level'], 1),
        companion: json['companion']?.toString() ?? 'MALE',
        accuracyPercent: _double(json['accuracyPercent']),
      );

  LeaderboardEntry toLegacy() => LeaderboardEntry(
    rank: rank,
    name: displayName,
    avatarPath: '',
    points: points,
    level: level,
    schoolName: schoolName ?? '',
    streakDays: 0,
    rankChange: 0,
  );
}

final class LeaderboardPage {
  final String period;
  final String scope;
  final String metric;
  final LeaderboardPlayer? currentUser;
  final List<LeaderboardPlayer> topPlayers;
  final PageMeta pagination;

  const LeaderboardPage({
    required this.period,
    required this.scope,
    required this.metric,
    this.currentUser,
    required this.topPlayers,
    required this.pagination,
  });

  factory LeaderboardPage.fromJson(Map<String, dynamic> json) =>
      LeaderboardPage(
        period: json['period']?.toString() ?? 'weekly',
        scope: json['scope']?.toString() ?? 'global',
        metric: json['metric']?.toString() ?? 'xp',
        currentUser: json['currentUser'] is Map
            ? LeaderboardPlayer.fromJson(requireObject(json['currentUser']))
            : null,
        topPlayers: _objects(json['topPlayers'], LeaderboardPlayer.fromJson),
        pagination: PageMeta.fromJson(
          requireObject(json['pagination'], 'pagination'),
        ),
      );
}

int _int(Object? value, [int fallback = 0]) => value is num
    ? value.toInt()
    : int.tryParse(value?.toString() ?? '') ?? fallback;
double _double(Object? value) => value is num
    ? value.toDouble()
    : double.tryParse(value?.toString() ?? '') ?? 0;
DateTime _date(Object? value) =>
    DateTime.tryParse(value?.toString() ?? '')?.toUtc() ??
    DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
DateTime? _nullableDate(Object? value) => value == null ? null : _date(value);
List<T> _objects<T>(Object? value, T Function(Map<String, dynamic>) parser) =>
    value is List
    ? value.map((item) => parser(requireObject(item))).toList(growable: false)
    : const [];
