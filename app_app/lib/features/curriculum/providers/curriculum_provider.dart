import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/repositories/providers.dart';
import '../../../core/models/subject_model.dart';

List<dynamic> _safeExtractList(dynamic responseData) {
  if (responseData == null) return const [];
  if (responseData is List) return responseData;
  if (responseData is Map) {
    final dynamic dataField = responseData['data'];
    if (dataField is List) return dataField;
    final dynamic itemsField = responseData['items'];
    if (itemsField is List) return itemsField;
  }
  return const [];
}

// --- Subjects Provider ---
final curriculumSubjectsProvider = FutureProvider<List<SubjectModel>>((ref) async {
  final dio = ref.watch(dioClientProvider).dio;
  try {
    final response = await dio.get('/study-resources/subjects');
    final rawList = _safeExtractList(response.data);

    if (rawList.isNotEmpty) {
      return rawList.map((item) {
        if (item is! Map) {
          return const SubjectModel(
            id: '',
            name: '',
            icon: 'book',
            colorHex: '#315BE8',
            unitsCount: 0,
            lessonsCount: 0,
            questionsCount: 0,
            progressPercent: 0,
            correctAnswers: 0,
            wrongAnswers: 0,
            masteryPercent: 0,
            isFavorite: false,
          );
        }
        final json = Map<String, dynamic>.from(item);
        return SubjectModel(
          id: json['id']?.toString() ?? '',
          name: json['name']?.toString() ?? '',
          icon: json['iconKey']?.toString() ?? json['icon']?.toString() ?? 'book',
          colorHex: json['colorHex']?.toString() ?? '#315BE8',
          coverImageUrl: json['coverImageUrl']?.toString(),
          unitsCount: (json['unitsCount'] as num?)?.toInt() ?? 0,
          lessonsCount: (json['lessonsCount'] as num?)?.toInt() ?? 0,
          questionsCount: (json['questionsCount'] as num?)?.toInt() ?? 0,
          progressPercent: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          masteryPercent: 0,
          isFavorite: json['isFavorite'] == true,
        );
      }).where((s) => s.id.isNotEmpty).toList();
    }
  } catch (_) {
    // Fall back to main subjects repository
  }

  // Graceful fallback to education subjects repository
  return ref.read(subjectsRepositoryProvider).getSubjects();
});

// --- Resources Provider ---
final curriculumResourcesProvider =
    FutureProvider.family<List<StudyResource>, String>((ref, subjectId) async {
  final dio = ref.watch(dioClientProvider).dio;
  try {
    final response =
        await dio.get('/study-resources/subjects/$subjectId/resources');
    final rawList = _safeExtractList(response.data);

    return rawList
        .whereType<Map>()
        .map((item) => StudyResource.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  } catch (_) {
    return const [];
  }
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

  const StudyResource({
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
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      description: json['description']?.toString(),
      category: json['category']?.toString() ?? 'OTHER',
      fileKey: json['fileKey']?.toString() ?? '',
      fileName: json['fileName']?.toString() ?? '',
      mimeType: json['mimeType']?.toString() ?? 'application/octet-stream',
      fileSize: (json['fileSize'] as num?)?.toInt() ?? 0,
      downloadCount: (json['downloadCount'] as num?)?.toInt() ?? 0,
    );
  }
}
