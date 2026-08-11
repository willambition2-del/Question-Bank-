import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/exam_model.dart';
import '../../../core/repositories/providers.dart';

class ExamModelsState {
  final AsyncValue<List<ExamModel>> exams;
  final String searchQuery;
  final String? selectedSubjectId;
  final int? selectedYear;
  final String? selectedSourceId; // 'صنعاء', 'عدن'
  final bool? isCompleted; // null: all, true: completed, false: uncompleted

  const ExamModelsState({
    required this.exams,
    this.searchQuery = "",
    this.selectedSubjectId,
    this.selectedYear,
    this.selectedSourceId,
    this.isCompleted,
  });

  ExamModelsState copyWith({
    AsyncValue<List<ExamModel>>? exams,
    String? searchQuery,
    String? selectedSubjectId,
    int? selectedYear,
    String? selectedSourceId,
    bool? isCompleted,
  }) {
    return ExamModelsState(
      exams: exams ?? this.exams,
      searchQuery: searchQuery ?? this.searchQuery,
      selectedSubjectId: selectedSubjectId ?? this.selectedSubjectId,
      selectedYear: selectedYear ?? this.selectedYear,
      selectedSourceId: selectedSourceId ?? this.selectedSourceId,
      isCompleted: isCompleted ?? this.isCompleted,
    );
  }
}

class ExamModelsNotifier extends Notifier<ExamModelsState> {
  @override
  ExamModelsState build() {
    Future.microtask(() => _loadExams());
    return const ExamModelsState(exams: AsyncValue.loading());
  }

  Future<void> _loadExams() async {
    state = state.copyWith(exams: const AsyncValue.loading());
    try {
      final list = await ref.read(examModelsRepositoryProvider).getExamModels();
      state = state.copyWith(exams: AsyncValue.data(list));
    } catch (e, st) {
      state = state.copyWith(exams: AsyncValue.error(e, st));
    }
  }

  void setSearchQuery(String query) {
    state = state.copyWith(searchQuery: query);
  }

  void selectSubject(String? subjectId) {
    state = state.copyWith(selectedSubjectId: subjectId);
  }

  void selectYear(int? year) {
    state = state.copyWith(selectedYear: year);
  }

  void selectSource(String? sourceId) {
    state = state.copyWith(selectedSourceId: sourceId);
  }

  void selectCompletion(bool? isCompleted) {
    state = state.copyWith(isCompleted: isCompleted);
  }

  void clearAllFilters() {
    state = state.copyWith(
      selectedSubjectId: null,
      selectedYear: null,
      selectedSourceId: null,
      isCompleted: null,
      searchQuery: "",
    );
  }

  List<ExamModel> getFilteredExams() {
    final asyncVal = state.exams;
    if (!asyncVal.hasValue) return [];

    List<ExamModel> list = List.from(asyncVal.value!);

    // 1. Search filter
    if (state.searchQuery.trim().isNotEmpty) {
      final query = state.searchQuery.toLowerCase();
      list = list.where((e) => e.title.toLowerCase().contains(query)).toList();
    }

    // 2. Subject filter
    if (state.selectedSubjectId != null) {
      list = list.where((e) => e.subjectId == state.selectedSubjectId).toList();
    }

    // 3. Year filter
    if (state.selectedYear != null) {
      list = list.where((e) => e.year == state.selectedYear).toList();
    }

    // 4. Source filter
    if (state.selectedSourceId != null) {
      list = list
          .where((e) => e.sourceId.contains(state.selectedSourceId!))
          .toList();
    }

    // 5. Completion filter
    if (state.isCompleted != null) {
      list = list.where((e) => e.isCompleted == state.isCompleted).toList();
    }

    return list;
  }
}

final examModelsNotifierProvider =
    NotifierProvider<ExamModelsNotifier, ExamModelsState>(() {
      return ExamModelsNotifier();
    });
