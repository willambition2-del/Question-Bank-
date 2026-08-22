import 'package:dio/dio.dart';

import '../models/exam_model.dart';
import '../models/lesson_model.dart';
import '../models/subject_model.dart';
import '../models/unit_model.dart';
import '../network/api_call.dart';
import '../network/api_response.dart';
import 'interfaces.dart';

final class SubjectsApiRepository implements SubjectsRepository {
  final Dio _dio;

  SubjectsApiRepository(this._dio);

  @override
  Future<List<SubjectModel>> getSubjects() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/subjects',
        queryParameters: const {'page': 1, 'limit': 100},
      );
      final root = requireObject(response.data);
      return requireList(root['data'])
          .map((item) => _subject(requireObject(item, 'subject')))
          .toList(growable: false);
    } on DioException catch (error) {
      throwApiError(error);
    }
  }

  @override
  Future<SubjectModel?> getSubjectById(String id) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/subjects/$id');
      return _subject(requireObject(requireObject(response.data)['data']));
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) return null;
      throwApiError(error);
    }
  }

  @override
  Future<void> toggleFavoriteSubject(String id) async {
    final current = await getSubjectById(id);
    if (current == null) return;
    try {
      if (current.isFavorite) {
        await _dio.delete<Map<String, dynamic>>('/subjects/$id/favorite');
      } else {
        await _dio.post<Map<String, dynamic>>('/subjects/$id/favorite');
      }
    } on DioException catch (error) {
      throwApiError(error);
    }
  }

  SubjectModel _subject(Map<String, dynamic> json) {
    final progress = json['progress'] is Map
        ? Map<String, dynamic>.from(json['progress'] as Map)
        : const <String, dynamic>{};
    final answered = (progress['answeredQuestions'] as num?)?.toInt() ?? 0;
    final correct = (progress['correctAnswers'] as num?)?.toInt() ?? 0;
    return SubjectModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      icon: json['iconKey']?.toString() ?? 'book',
      colorHex: json['colorHex']?.toString() ?? '#315BE8',
      coverImageUrl: json['coverImageUrl']?.toString(),
      unitsCount: (json['unitsCount'] as num?)?.toInt() ?? 0,
      lessonsCount: (json['lessonsCount'] as num?)?.toInt() ?? 0,
      questionsCount: (json['questionsCount'] as num?)?.toInt() ?? 0,
      progressPercent: _ratio(progress['masteryPercent']),
      correctAnswers: correct,
      wrongAnswers: (answered - correct).clamp(0, answered).toInt(),
      masteryPercent: _ratio(progress['masteryPercent']),
      isFavorite: json['isFavorite'] == true,
      lastActivity: progress['lastActivityAt']?.toString(),
    );
  }
}

final class UnitsApiRepository implements UnitsRepository {
  final Dio _dio;

  UnitsApiRepository(this._dio);

  @override
  Future<List<UnitModel>> getUnits(String subjectId) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/subjects/$subjectId/units',
      );
      return requireList(requireObject(response.data)['data'])
          .map((item) => _unit(Map<String, dynamic>.from(item as Map)))
          .toList(growable: false);
    } on DioException catch (error) {
      throwApiError(error);
    }
  }

  @override
  Future<UnitModel?> getUnitById(String id) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/units/$id');
      return _unit(requireObject(requireObject(response.data)['data']));
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) return null;
      throwApiError(error);
    }
  }

  UnitModel _unit(Map<String, dynamic> json) {
    final progress = json['progress'] is Map
        ? Map<String, dynamic>.from(json['progress'] as Map)
        : const <String, dynamic>{};
    final answered = (progress['answeredQuestions'] as num?)?.toInt() ?? 0;
    final mastery = _ratio(progress['masteryPercent']);
    return UnitModel(
      id: json['id']?.toString() ?? '',
      subjectId: json['subjectId']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      lessonsCount: (json['lessonsCount'] as num?)?.toInt() ?? 0,
      questionsCount: (json['questionsCount'] as num?)?.toInt() ?? 0,
      progressPercent: mastery,
      status: answered == 0
          ? 'notStarted'
          : mastery >= 1
          ? 'completed'
          : 'inProgress',
    );
  }
}

final class LessonsApiRepository implements LessonsRepository {
  final Dio _dio;

  LessonsApiRepository(this._dio);

  @override
  Future<List<LessonModel>> getLessons(String subjectId, String unitId) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/units/$unitId/lessons',
      );
      return requireList(requireObject(response.data)['data'])
          .map((item) => _lesson(Map<String, dynamic>.from(item as Map)))
          .toList(growable: false);
    } on DioException catch (error) {
      throwApiError(error);
    }
  }

  @override
  Future<LessonModel?> getLessonById(String id) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/lessons/$id');
      return _lesson(requireObject(requireObject(response.data)['data']));
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) return null;
      throwApiError(error);
    }
  }

  LessonModel _lesson(Map<String, dynamic> json) {
    final progress = json['progress'] is Map
        ? Map<String, dynamic>.from(json['progress'] as Map)
        : const <String, dynamic>{};
    final answered = (progress['answeredQuestions'] as num?)?.toInt() ?? 0;
    final correct = (progress['correctAnswers'] as num?)?.toInt() ?? 0;
    final mastery = _ratio(progress['masteryPercent']);
    return LessonModel(
      id: json['id']?.toString() ?? '',
      subjectId: json['subjectId']?.toString() ?? '',
      unitId: json['unitId']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      questionsCount: (json['questionsCount'] as num?)?.toInt() ?? 0,
      correctCount: correct,
      wrongCount: (answered - correct).clamp(0, answered).toInt(),
      masteryPercent: mastery,
      lastAttempt: progress['lastActivityAt']?.toString(),
      status: answered == 0
          ? 'notStarted'
          : mastery >= .8
          ? 'mastered'
          : mastery >= .6
          ? 'good'
          : 'needsReview',
    );
  }
}

final class ExamModelsApiRepository implements ExamModelsRepository {
  final Dio _dio;

  ExamModelsApiRepository(this._dio);

  @override
  Future<List<ExamModel>> getExamModels({
    String? subjectId,
    int? year,
    String? sourceId,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/exam-models',
        queryParameters: {
          'page': 1,
          'limit': 100,
          if (subjectId != null) 'subjectId': subjectId,
          if (year != null) 'year': year,
          if (sourceId != null) 'sourceId': sourceId,
        },
      );
      return requireList(requireObject(response.data)['data'])
          .map((item) => _exam(requireObject(item, 'exam model')))
          .toList(growable: false);
    } on DioException catch (error) {
      throwApiError(error);
    }
  }

  @override
  Future<ExamModel?> getExamModelById(String id) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/exam-models/$id');
      return _exam(requireObject(requireObject(response.data)['data']));
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) return null;
      throwApiError(error);
    }
  }

  ExamModel _exam(Map<String, dynamic> json) {
    final subject = json['subject'] is Map
        ? Map<String, dynamic>.from(json['subject'] as Map)
        : const <String, dynamic>{};
    final source = json['source'] is Map
        ? Map<String, dynamic>.from(json['source'] as Map)
        : const <String, dynamic>{};
    return ExamModel(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      subjectId: subject['id']?.toString() ?? '',
      sourceId: source['id']?.toString() ?? '',
      year: (json['year'] as num?)?.toInt() ?? 0,
      questionsCount: (json['questionsCount'] as num?)?.toInt() ?? 0,
      durationMinutes: (json['durationMinutes'] as num?)?.toInt() ?? 0,
      difficulty: json['difficulty']?.toString().toLowerCase() ?? 'medium',
      attemptsCount: 0,
      bestScore: null,
      isCompleted: false,
      isOfficial: json['isOfficial'] == true,
    );
  }
}

double _ratio(Object? value) {
  final number = value is num ? value.toDouble() : 0.0;
  return (number / 100).clamp(0.0, 1.0);
}
