class EducationContext {
  final String gradeId;
  final String gradeName;
  final String curriculumId;
  final String curriculumName;
  final String? trackId;
  final String? trackName;
  final String countryCode;

  const EducationContext({
    required this.gradeId,
    required this.gradeName,
    required this.curriculumId,
    required this.curriculumName,
    this.trackId,
    this.trackName,
    required this.countryCode,
  });

  EducationContext copyWith({
    String? gradeId,
    String? gradeName,
    String? curriculumId,
    String? curriculumName,
    String? trackId,
    String? trackName,
    String? countryCode,
  }) {
    return EducationContext(
      gradeId: gradeId ?? this.gradeId,
      gradeName: gradeName ?? this.gradeName,
      curriculumId: curriculumId ?? this.curriculumId,
      curriculumName: curriculumName ?? this.curriculumName,
      trackId: trackId ?? this.trackId,
      trackName: trackName ?? this.trackName,
      countryCode: countryCode ?? this.countryCode,
    );
  }
}
