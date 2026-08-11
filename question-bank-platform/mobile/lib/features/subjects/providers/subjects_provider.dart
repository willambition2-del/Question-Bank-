import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/subject_model.dart';
import '../../../core/repositories/providers.dart';

class SubjectsState {
  final AsyncValue<List<SubjectModel>> subjects;
  final String searchQuery;
  final String
  activeFilter; // 'all', 'favorites', 'highProgress', 'lowProgress', 'weakest', 'recent'

  const SubjectsState({
    required this.subjects,
    this.searchQuery = "",
    this.activeFilter = "all",
  });

  SubjectsState copyWith({
    AsyncValue<List<SubjectModel>>? subjects,
    String? searchQuery,
    String? activeFilter,
  }) {
    return SubjectsState(
      subjects: subjects ?? this.subjects,
      searchQuery: searchQuery ?? this.searchQuery,
      activeFilter: activeFilter ?? this.activeFilter,
    );
  }
}

class SubjectsNotifier extends Notifier<SubjectsState> {
  final Map<String, String> _searchTermsBySubject = {};
  @override
  SubjectsState build() {
    Future.microtask(() => loadSubjects());
    return const SubjectsState(subjects: AsyncValue.loading());
  }

  Future<void> loadSubjects() async {
    state = state.copyWith(subjects: const AsyncValue.loading());
    try {
      final list = await ref.read(subjectsRepositoryProvider).getSubjects();
      await Future.wait(list.map(_loadSearchTerms));
      state = state.copyWith(subjects: AsyncValue.data(list));
    } catch (e, st) {
      state = state.copyWith(subjects: AsyncValue.error(e, st));
    }
  }

  Future<void> _loadSearchTerms(SubjectModel subject) async {
    try {
      final units = await ref
          .read(unitsRepositoryProvider)
          .getUnits(subject.id);
      final lessons = await Future.wait(
        units.map(
          (unit) => ref
              .read(lessonsRepositoryProvider)
              .getLessons(subject.id, unit.id),
        ),
      );
      _searchTermsBySubject[subject.id] = [
        ...units.map((unit) => unit.name),
        ...lessons.expand((items) => items).map((lesson) => lesson.name),
      ].join(' ').toLowerCase();
    } catch (_) {
      _searchTermsBySubject[subject.id] = '';
    }
  }

  void setSearchQuery(String query) {
    state = state.copyWith(searchQuery: query);
  }

  void setFilter(String filter) {
    state = state.copyWith(activeFilter: filter);
  }

  Future<void> toggleFavorite(String id) async {
    await ref.read(subjectsRepositoryProvider).toggleFavoriteSubject(id);
    final list = await ref.read(subjectsRepositoryProvider).getSubjects();
    state = state.copyWith(subjects: AsyncValue.data(list));
  }

  List<SubjectModel> getFilteredSubjects() {
    final asyncVal = state.subjects;
    if (!asyncVal.hasValue) return [];

    List<SubjectModel> list = List.from(asyncVal.value!);

    // 1. Search Query Filter (Checks subject, unit, and lesson names)
    if (state.searchQuery.trim().isNotEmpty) {
      final query = state.searchQuery.toLowerCase();
      list = list.where((sub) {
        if (sub.name.toLowerCase().contains(query)) return true;

        return (_searchTermsBySubject[sub.id] ?? '').contains(query);
      }).toList();
    }

    // 2. Active Filter Options
    switch (state.activeFilter) {
      case "favorites":
        list = list.where((sub) => sub.isFavorite).toList();
        break;
      case "highProgress":
        list.sort((a, b) => b.progressPercent.compareTo(a.progressPercent));
        break;
      case "lowProgress":
        list.sort((a, b) => a.progressPercent.compareTo(b.progressPercent));
        break;
      case "weakest":
        list.sort((a, b) => a.masteryPercent.compareTo(b.masteryPercent));
        break;
      case "recent":
        list.sort(
          (a, b) => (b.lastActivity ?? '').compareTo(a.lastActivity ?? ''),
        );
        break;
      case "all":
      default:
        break;
    }

    return list;
  }
}

final subjectsNotifierProvider =
    NotifierProvider<SubjectsNotifier, SubjectsState>(() {
      return SubjectsNotifier();
    });
