import '../models/student_model.dart';
import '../models/subject_model.dart';
import '../models/unit_model.dart';
import '../models/lesson_model.dart';
import '../models/question_model.dart';
import '../models/exam_model.dart';
import '../models/quiz_attempt.dart';
import '../models/reading_passage.dart';
import '../models/leaderboard_entry.dart';
import '../models/achievement_model.dart';
import '../models/daily_task_model.dart';
import '../models/update_model.dart';

class GoogleAuthSession {
  final StudentModel user;
  final bool isNewUser;

  const GoogleAuthSession({required this.user, required this.isNewUser});
}

abstract interface class AuthRepository {
  Future<StudentModel?> login(String username, String password);
  Future<GoogleAuthSession> loginWithGoogle(String idToken);
  Future<StudentModel?> register({
    required String name,
    required String username,
    required String phone,
    required String schoolName,
    required String password,
  });
  Future<StudentModel?> getLoggedInStudent();
  Future<StudentModel> completeOnboarding({
    required String schoolName,
    required String governorate,
    required String gradeLevel,
    String? phone,
  });
  Future<StudentModel> updateProfile({
    String? name,
    String? schoolName,
    String? governorate,
    String? gradeLevel,
    String? phone,
  });

  Future<void> updateStudentPointsAndStats(
    int points,
    int completedQuestions,
    double accuracy,
  );
  Future<void> logout();
}

abstract interface class SubjectsRepository {
  Future<List<SubjectModel>> getSubjects();
  Future<SubjectModel?> getSubjectById(String id);
  Future<void> toggleFavoriteSubject(String id);
}

abstract interface class UnitsRepository {
  Future<List<UnitModel>> getUnits(String subjectId);
  Future<UnitModel?> getUnitById(String id);
}

abstract interface class LessonsRepository {
  Future<List<LessonModel>> getLessons(String subjectId, String unitId);
  Future<LessonModel?> getLessonById(String id);
}

abstract interface class ExamModelsRepository {
  Future<List<ExamModel>> getExamModels({
    String? subjectId,
    int? year,
    String? sourceId,
  });
  Future<ExamModel?> getExamModelById(String id);
}

abstract interface class QuizRepository {
  Future<List<QuestionModel>> getQuestionsForQuiz({
    String? subjectId,
    String? unitId,
    String? lessonId,
    String? examModelId,
    required int count,
    required String difficulty,
    required String type, // 'multipleChoice', 'trueFalse', 'mixed'
  });
  Future<ReadingPassage?> getReadingPassageById(String id);
  Future<void> saveQuizAttempt(QuizAttempt attempt);
  Future<List<QuizAttempt>> getQuizAttempts();
}

abstract interface class MistakesRepository {
  Future<List<QuestionModel>> getWrongQuestions();
  Future<void> recordMistake(String questionId);
  Future<void> resolveMistake(String questionId);
}

abstract interface class SavedQuestionsRepository {
  Future<List<QuestionModel>> getSavedQuestions();
  Future<void> saveQuestion(String questionId);
  Future<void> unsaveQuestion(String questionId);
}

abstract interface class LeaderboardRepository {
  Future<List<LeaderboardEntry>> getLeaderboard(
    String timeFilter,
    String typeFilter,
  );
}

abstract interface class AchievementsRepository {
  Future<List<AchievementModel>> getAchievements();
  Future<void> unlockAchievement(String id);
}

abstract interface class DailyTasksRepository {
  Future<List<DailyTaskModel>> getDailyTasks();
  Future<void> updateDailyTaskProgress(String id, int progress);
}

abstract interface class UpdatesRepository {
  Future<List<UpdateModel>> getUpdates();
}
