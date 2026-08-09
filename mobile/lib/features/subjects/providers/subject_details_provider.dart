import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/subject_model.dart';
import '../../../core/models/unit_model.dart';
import '../../../core/models/lesson_model.dart';
import '../../../core/models/exam_model.dart';
import '../../../core/repositories/providers.dart';

// Fetch single subject profile
final subjectDetailsProvider = FutureProvider.family<SubjectModel?, String>((
  ref,
  subjectId,
) {
  return ref.read(subjectsRepositoryProvider).getSubjectById(subjectId);
});

// Fetch units of a subject
final subjectUnitsProvider = FutureProvider.family<List<UnitModel>, String>((
  ref,
  subjectId,
) {
  return ref.read(unitsRepositoryProvider).getUnits(subjectId);
});

// Fetch lessons of a unit, argument is "subjectId:unitId"
final unitLessonsProvider = FutureProvider.family<List<LessonModel>, String>((
  ref,
  arg,
) {
  final parts = arg.split(':');
  final subjectId = parts[0];
  final unitId = parts[1];
  return ref.read(lessonsRepositoryProvider).getLessons(subjectId, unitId);
});

// Fetch single unit details
final unitDetailsProvider = FutureProvider.family<UnitModel?, String>((
  ref,
  unitId,
) {
  return ref.read(unitsRepositoryProvider).getUnitById(unitId);
});

// Fetch single lesson details
final lessonDetailsProvider = FutureProvider.family<LessonModel?, String>((
  ref,
  lessonId,
) {
  return ref.read(lessonsRepositoryProvider).getLessonById(lessonId);
});

// Fetch exam models
final examModelsListProvider =
    FutureProvider.family<
      List<ExamModel>,
      ({String? subjectId, int? year, String? sourceId})
    >((ref, arg) {
      return ref
          .read(examModelsRepositoryProvider)
          .getExamModels(
            subjectId: arg.subjectId,
            year: arg.year,
            sourceId: arg.sourceId,
          );
    });
