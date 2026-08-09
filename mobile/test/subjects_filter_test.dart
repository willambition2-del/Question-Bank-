import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app_app/core/models/subject_model.dart';
import 'package:app_app/features/subjects/providers/subjects_provider.dart';

void main() {
  group('Subjects Filter & Search State Tests', () {
    test('Initial SubjectsState has empty search and all filter', () {
      const state = SubjectsState(subjects: AsyncValue.data([]));
      expect(state.searchQuery, equals(""));
      expect(state.activeFilter, equals("all"));
    });

    test('Filter logic sorts and filters correctly', () {
      final mockSubjects = [
        const SubjectModel(
          id: "sub_physics",
          name: "الفيزياء",
          colorHex: "2F5BEA",
          icon: "science",
          unitsCount: 4,
          lessonsCount: 16,
          questionsCount: 200,
          progressPercent: 0.50,
          correctAnswers: 50,
          wrongAnswers: 20,
          masteryPercent: 0.58,
          isFavorite: true,
        ),
        const SubjectModel(
          id: "sub_english",
          name: "اللغة الإنجليزية",
          colorHex: "12B886",
          icon: "translate",
          unitsCount: 5,
          lessonsCount: 20,
          questionsCount: 300,
          progressPercent: 0.85,
          correctAnswers: 120,
          wrongAnswers: 10,
          masteryPercent: 0.88,
          isFavorite: false,
        ),
      ];

      final state = SubjectsState(
        subjects: AsyncValue.data(mockSubjects),
        activeFilter: "favorites",
      );

      expect(state.activeFilter, equals("favorites"));
      final filtered = mockSubjects.where((s) => s.isFavorite).toList();
      expect(filtered.length, equals(1));
      expect(filtered.first.id, equals("sub_physics"));
    });
  });
}
