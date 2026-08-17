class StudentModel {
  final String id;
  final String name;
  final String username;
  final String phone;
  final String? email;
  final String schoolName;
  final String? governorate;
  final String? gradeLevel;
  final bool onboardingCompleted;
  final int level;
  final int points;
  final int rank;
  final int streakDays;
  final int completedQuestions;
  final double overallAccuracy;
  final bool soundsEnabled;
  final bool hapticsEnabled;

  const StudentModel({
    required this.id,
    required this.name,
    required this.username,
    required this.phone,
    this.email,
    required this.schoolName,
    this.governorate,
    this.gradeLevel = 'THIRD_SECONDARY',
    this.onboardingCompleted = false,
    required this.level,
    required this.points,
    required this.rank,
    required this.streakDays,
    required this.completedQuestions,
    required this.overallAccuracy,
    this.soundsEnabled = true,
    this.hapticsEnabled = true,
  });

  StudentModel copyWith({
    String? id,
    String? name,
    String? username,
    String? phone,
    String? email,
    String? schoolName,
    String? governorate,
    String? gradeLevel,
    bool? onboardingCompleted,
    int? level,
    int? points,
    int? rank,
    int? streakDays,
    int? completedQuestions,
    double? overallAccuracy,
    bool? soundsEnabled,
    bool? hapticsEnabled,
  }) {
    return StudentModel(
      id: id ?? this.id,
      name: name ?? this.name,
      username: username ?? this.username,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      schoolName: schoolName ?? this.schoolName,
      governorate: governorate ?? this.governorate,
      gradeLevel: gradeLevel ?? this.gradeLevel,
      onboardingCompleted: onboardingCompleted ?? this.onboardingCompleted,
      level: level ?? this.level,
      points: points ?? this.points,
      rank: rank ?? this.rank,
      streakDays: streakDays ?? this.streakDays,
      completedQuestions: completedQuestions ?? this.completedQuestions,
      overallAccuracy: overallAccuracy ?? this.overallAccuracy,
      soundsEnabled: soundsEnabled ?? this.soundsEnabled,
      hapticsEnabled: hapticsEnabled ?? this.hapticsEnabled,
    );
  }
}

