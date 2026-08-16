import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/repositories/providers.dart';
import '../../../core/models/subject_model.dart';

// --- Subjects Provider ---
final curriculumSubjectsProvider = FutureProvider<List<SubjectModel>>((ref) async {
  final dio = ref.watch(dioClientProvider).dio;
  final response = await dio.get('/study-resources/subjects');
  return (response.data['data'] as List)
      .map((json) => SubjectModel(
            id: json['id'],
            name: json['name'],
            icon: json['icon'] ?? 'Book',
            colorHex: json['colorHex'] ?? '#000000',
            unitsCount: 0,
            lessonsCount: 0,
            questionsCount: 0,
            progressPercent: 0,
            correctAnswers: 0,
            wrongAnswers: 0,
            masteryPercent: 0,
            isFavorite: false,
          ))
      .toList();
});

// --- Resources Provider ---
final curriculumResourcesProvider =
    FutureProvider.family<List<StudyResource>, String>((ref, subjectId) async {
  final dio = ref.watch(dioClientProvider).dio;
  final response = await dio.get('/study-resources/subjects/$subjectId/resources');
  return (response.data['data'] as List)
      .map((json) => StudyResource.fromJson(json))
      .toList();
});

// --- Model ---
class StudyResource {
  final String id;
  final String title;
  final String? description;
  final String category;
  final String fileKey;
  final String fileName;
  final String mimeType;
  final int fileSize;
  final int downloadCount;

  StudyResource({
    required this.id,
    required this.title,
    this.description,
    required this.category,
    required this.fileKey,
    required this.fileName,
    required this.mimeType,
    required this.fileSize,
    required this.downloadCount,
  });

  factory StudyResource.fromJson(Map<String, dynamic> json) {
    return StudyResource(
      id: json['id'],
      title: json['title'],
      description: json['description'],
      category: json['category'],
      fileKey: json['fileKey'],
      fileName: json['fileName'],
      mimeType: json['mimeType'],
      fileSize: json['fileSize'],
      downloadCount: json['downloadCount'],
    );
  }
}
