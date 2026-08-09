import 'companion_enums.dart';

class StudentModel {
  final String id;
  final String name;
  final String username;
  final String phone;
  final String? email;
  final String schoolName;
  final int level;
  final int points;
  final int rank;
  final int streakDays;
  final int completedQuestions;
  final double overallAccuracy;
  final CompanionType selectedCompanionType;
  final MotionLevel motionLevel;
  final bool soundsEnabled;
  final bool hapticsEnabled;

  const StudentModel({
    required this.id,
    required this.name,
    required this.username,
    required this.phone,
    this.email,
    required this.schoolName,
    required this.level,
    required this.points,
    required this.rank,
    required this.streakDays,
    required this.completedQuestions,
    required this.overallAccuracy,
    required this.selectedCompanionType,
    required this.motionLevel,
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
    int? level,
    int? points,
    int? rank,
    int? streakDays,
    int? completedQuestions,
    double? overallAccuracy,
    CompanionType? selectedCompanionType,
    MotionLevel? motionLevel,
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
      level: level ?? this.level,
      points: points ?? this.points,
      rank: rank ?? this.rank,
      streakDays: streakDays ?? this.streakDays,
      completedQuestions: completedQuestions ?? this.completedQuestions,
      overallAccuracy: overallAccuracy ?? this.overallAccuracy,
      selectedCompanionType:
          selectedCompanionType ?? this.selectedCompanionType,
      motionLevel: motionLevel ?? this.motionLevel,
      soundsEnabled: soundsEnabled ?? this.soundsEnabled,
      hapticsEnabled: hapticsEnabled ?? this.hapticsEnabled,
    );
  }
}
