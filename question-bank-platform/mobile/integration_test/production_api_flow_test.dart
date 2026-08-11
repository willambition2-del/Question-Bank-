import 'package:app_app/core/network/dio_client.dart';
import 'package:app_app/core/repositories/analytics_api_repositories.dart';
import 'package:app_app/core/repositories/auth_api_repository.dart';
import 'package:app_app/core/repositories/challenge_api_repository.dart';
import 'package:app_app/core/repositories/education_api_repositories.dart';
import 'package:app_app/core/repositories/notifications_api_repository.dart';
import 'package:app_app/core/repositories/progress_api_repositories.dart';
import 'package:app_app/core/repositories/quiz_api_repository.dart';
import 'package:app_app/core/storage/token_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

const username = String.fromEnvironment('API_TEST_USERNAME');
const password = String.fromEnvironment('API_TEST_PASSWORD');

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'authenticated production API flow against isolated test backend',
    (tester) async {
      final tokens = _IntegrationTokenStorage();
      final dio = DioClient(tokenStorage: tokens).dio;
      final auth = AuthApiRepository(dio, tokens);
      final education = (
        subjects: SubjectsApiRepository(dio),
        units: UnitsApiRepository(dio),
        lessons: LessonsApiRepository(dio),
        exams: ExamModelsApiRepository(dio),
      );
      final quiz = QuizApiRepository(DioQuizRemoteDataSource(dio));
      final progressSource = DioProgressRemoteDataSource(dio);
      final mistakes = MistakesApiRepository(progressSource);
      final saved = SavedQuestionsApiRepository(progressSource);
      final analyticsSource = AnalyticsRemoteDataSource(dio);

      final student = await auth.login(username, password);
      expect(student, isNotNull);
      expect(
        await auth.getLoggedInStudent(),
        isNotNull,
        reason: 'session restoration',
      );

      try {
        final subjects = await education.subjects.getSubjects();
        expect(
          subjects,
          isNotEmpty,
          reason: 'test backend needs published content',
        );
        final subject = await education.subjects.getSubjectById(
          subjects.first.id,
        );
        expect(subject, isNotNull);

        final units = await education.units.getUnits(subjects.first.id);
        expect(units, isNotEmpty);
        expect(await education.units.getUnitById(units.first.id), isNotNull);

        final lessons = await education.lessons.getLessons(
          subjects.first.id,
          units.first.id,
        );
        expect(lessons, isNotEmpty);
        expect(
          await education.lessons.getLessonById(lessons.first.id),
          isNotNull,
        );
        await education.exams.getExamModels(subjectId: subjects.first.id);

        final started = await quiz.create(
          QuizCreateRequest(
            scope: 'LESSON',
            lessonId: lessons.first.id,
            questionCount: 1,
            difficulty: 'MIXED',
            timingMode: 'NONE',
            heartsEnabled: false,
            initialHearts: 0,
            hintsEnabled: true,
            eliminationEnabled: false,
            explanationMode: 'AFTER_EACH',
            excludeMastered: false,
            unansweredOnly: false,
          ),
        );
        expect(started.questions, isNotEmpty);
        final question = started.questions.first;
        final selection = question.options.keys.first;
        final answer = await quiz.answer(
          started.attempt.id,
          question: question,
          selection: selection,
          timeSpentMs: 1000,
          hintUsed: false,
          eliminatedOptionUsed: false,
        );
        expect(answer.accepted, isTrue);
        if (answer.status == 'IN_PROGRESS') {
          await quiz.complete(started.attempt.id);
        }
        final result = await quiz.getResult(started.attempt.id);
        expect(result.summary.questionCount, greaterThan(0));
        expect((await quiz.getHistory(limit: 5)).items, isNotEmpty);

        await mistakes.list(limit: 5);
        await saved.save(question.id, note: 'integration-test');
        final savedPage = await saved.list(
          search: 'integration-test',
          limit: 5,
        );
        expect(
          savedPage.items.any((item) => item.question.id == question.id),
          isTrue,
        );
        await saved.remove(question.id);

        final statistics = StatisticsApiRepository(analyticsSource);
        await statistics.overview();
        await statistics.activity();
        await RecommendationsApiRepository(
          analyticsSource,
        ).get(subjectId: subjects.first.id);
        await GamificationApiRepository(analyticsSource).points();
        await AchievementsApiRepository(analyticsSource).list();
        await LeaderboardsApiRepository(analyticsSource).page(limit: 5);
        await NotificationsApiRepository(
          DioNotificationsRemoteDataSource(dio),
        ).list(limit: 5);
        await ChallengeApiRepository(DioChallengeRemoteDataSource(dio)).modes();
      } finally {
        await auth.logout();
      }
      expect(await tokens.readAccessToken(), isNull);
    },
    skip: username.isEmpty || password.isEmpty,
  );
}

final class _IntegrationTokenStorage implements TokenStorage {
  TokenPair? _tokens;
  @override
  Future<void> clear() async => _tokens = null;
  @override
  Future<String?> readAccessToken() async => _tokens?.accessToken;
  @override
  Future<String?> readRefreshToken() async => _tokens?.refreshToken;
  @override
  Future<void> write(TokenPair tokens) async => _tokens = tokens;
}
