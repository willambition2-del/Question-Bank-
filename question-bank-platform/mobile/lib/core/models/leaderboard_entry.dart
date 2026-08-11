class LeaderboardEntry {
  final int rank;
  final String name;
  final String avatarPath;
  final int points;
  final int level;
  final String schoolName;
  final int streakDays;
  final int rankChange; // e.g. +1, -2, 0

  const LeaderboardEntry({
    required this.rank,
    required this.name,
    required this.avatarPath,
    required this.points,
    required this.level,
    required this.schoolName,
    required this.streakDays,
    required this.rankChange,
  });
}
