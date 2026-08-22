import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:app_app/core/models/subject_model.dart';
import 'package:app_app/features/curriculum/presentation/curriculum_subjects_screen.dart';
import 'package:app_app/features/curriculum/providers/curriculum_provider.dart';

void main() {
  testWidgets('CurriculumSubjectsScreen renders subjects list without type errors',
      (WidgetTester tester) async {
    final fakeSubjects = [
      const SubjectModel(
        id: 'sub-1',
        name: 'القرآن الكريم',
        icon: 'book',
        colorHex: '#10B981',
        coverImageUrl: 'https://example.com/quran.jpg',
        unitsCount: 4,
        lessonsCount: 16,
        questionsCount: 996,
        progressPercent: 0.25,
        correctAnswers: 20,
        wrongAnswers: 5,
        masteryPercent: 0.8,
        isFavorite: true,
      ),
      const SubjectModel(
        id: 'sub-2',
        name: 'العلوم',
        icon: 'atom',
        colorHex: '#3B82F6',
        coverImageUrl: null,
        unitsCount: 6,
        lessonsCount: 24,
        questionsCount: 1233,
        progressPercent: 0.0,
        correctAnswers: 0,
        wrongAnswers: 0,
        masteryPercent: 0.0,
        isFavorite: false,
      ),
      const SubjectModel(
        id: 'sub-3',
        name: 'اللغة الإنجليزية',
        icon: 'languages',
        colorHex: '#8B5CF6',
        coverImageUrl: '/uploads/subjects/sub-3.png',
        unitsCount: 8,
        lessonsCount: 32,
        questionsCount: 1428,
        progressPercent: 0.5,
        correctAnswers: 50,
        wrongAnswers: 10,
        masteryPercent: 0.85,
        isFavorite: false,
      ),
    ];

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          curriculumSubjectsProvider.overrideWith((ref) => fakeSubjects),
        ],
        child: const MaterialApp(
          home: CurriculumSubjectsScreen(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    // Verify screen title and subjects render properly
    expect(find.text('المنهج الدراسي'), findsOneWidget);
    expect(find.text('القرآن الكريم'), findsOneWidget);
    expect(find.text('العلوم'), findsOneWidget);
    expect(find.text('اللغة الإنجليزية'), findsOneWidget);
    expect(find.text('اختر المادة لتصفح الملازم والكتب'), findsOneWidget);
  });

  testWidgets('CurriculumSubjectsScreen renders empty state correctly',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          curriculumSubjectsProvider.overrideWith((ref) => []),
        ],
        child: const MaterialApp(
          home: CurriculumSubjectsScreen(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('المنهج الدراسي'), findsOneWidget);
    expect(find.text('لا توجد مواد متاحة حالياً'), findsOneWidget);
  });

  testWidgets('CurriculumSubjectsScreen renders error state with retry button',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          curriculumSubjectsProvider.overrideWith(
            (ref) => throw Exception('Failed to load'),
          ),
        ],
        child: const MaterialApp(
          home: CurriculumSubjectsScreen(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('تعذر تحميل المنهج الدراسي'), findsOneWidget);
    expect(find.text('إعادة المحاولة'), findsOneWidget);
  });
}
