import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/dio_client.dart';
import '../storage/secure_token_storage.dart';
import '../storage/token_storage.dart';
import 'auth_api_repository.dart';
import 'education_api_repositories.dart';
import 'interfaces.dart';
import 'quiz_api_repository.dart';
import 'progress_api_repositories.dart' as progress;
import 'analytics_api_repositories.dart';
import 'challenge_api_repository.dart';
import 'notifications_api_repository.dart';
import '../../features/notifications/services/fcm_notification_service.dart';
import '../../features/challenges/services/challenge_socket_service.dart';
import '../../features/auth/services/google_sign_in_service.dart';
import '../../features/assistant/data/assistant_remote_data_source.dart';
import '../../features/assistant/domain/assistant_repository.dart';

final googleIdentityClientProvider = Provider<GoogleIdentityClient>((ref) {
  return PluginGoogleIdentityClient();
});

final googleSignInGatewayProvider = Provider<GoogleSignInGateway>((ref) {
  return GoogleSignInService(client: ref.read(googleIdentityClientProvider));
});
final tokenStorageProvider = Provider<TokenStorage>((ref) {
  return SecureTokenStorage();
});

final dioClientProvider = Provider<DioClient>((ref) {
  return DioClient(
    tokenStorage: ref.read(tokenStorageProvider),
    onSessionExpired: () async =>
        ref.read(challengeSocketServiceProvider).disconnect(),
    onTokensRefreshed: () =>
        ref.read(challengeSocketServiceProvider).reauthenticate(),
  );
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthApiRepository(
    ref.read(dioClientProvider).dio,
    ref.read(tokenStorageProvider),
  );
});

final assistantRemoteDataSourceProvider =
    Provider<AssistantRemoteDataSource>((ref) {
      return DioAssistantRemoteDataSource(ref.read(dioClientProvider).dio);
    });

final assistantRepositoryProvider = Provider<AssistantRepository>((ref) {
  return AssistantApiRepository(ref.read(assistantRemoteDataSourceProvider));
});

final subjectsRepositoryProvider = Provider<SubjectsRepository>((ref) {
  return SubjectsApiRepository(ref.read(dioClientProvider).dio);
});

final unitsRepositoryProvider = Provider<UnitsRepository>((ref) {
  return UnitsApiRepository(ref.read(dioClientProvider).dio);
});

final lessonsRepositoryProvider = Provider<LessonsRepository>((ref) {
  return LessonsApiRepository(ref.read(dioClientProvider).dio);
});

final examModelsRepositoryProvider = Provider<ExamModelsRepository>((ref) {
  return ExamModelsApiRepository(ref.read(dioClientProvider).dio);
});

final quizLifecycleRepositoryProvider = Provider<QuizLifecycleRepository>((
  ref,
) {
  return QuizApiRepository(
    DioQuizRemoteDataSource(ref.read(dioClientProvider).dio),
  );
});

final activeAttemptStorageProvider = Provider<ActiveAttemptStorage>((ref) {
  return ActiveAttemptStorage();
});

final progressRemoteDataSourceProvider =
    Provider<progress.ProgressRemoteDataSource>((ref) {
      return progress.DioProgressRemoteDataSource(
        ref.read(dioClientProvider).dio,
      );
    });

final mistakesRepositoryProvider = Provider<progress.MistakesRepository>((ref) {
  return progress.MistakesApiRepository(
    ref.read(progressRemoteDataSourceProvider),
  );
});

final savedQuestionsRepositoryProvider =
    Provider<progress.SavedQuestionsRepository>((ref) {
      return progress.SavedQuestionsApiRepository(
        ref.read(progressRemoteDataSourceProvider),
      );
    });

final analyticsRemoteDataSourceProvider = Provider<AnalyticsRemoteDataSource>((
  ref,
) {
  return AnalyticsRemoteDataSource(ref.read(dioClientProvider).dio);
});

final statisticsRepositoryProvider = Provider<StatisticsApiRepository>((ref) {
  return StatisticsApiRepository(ref.read(analyticsRemoteDataSourceProvider));
});

final recommendationsRepositoryProvider =
    Provider<RecommendationsApiRepository>((ref) {
      return RecommendationsApiRepository(
        ref.read(analyticsRemoteDataSourceProvider),
      );
    });

final gamificationRepositoryProvider = Provider<GamificationApiRepository>((
  ref,
) {
  return GamificationApiRepository(ref.read(analyticsRemoteDataSourceProvider));
});
final leaderboardsApiRepositoryProvider = Provider<LeaderboardsApiRepository>((
  ref,
) {
  return LeaderboardsApiRepository(ref.read(analyticsRemoteDataSourceProvider));
});

final leaderboardRepositoryProvider = Provider<LeaderboardRepository>((ref) {
  return ref.read(leaderboardsApiRepositoryProvider);
});

final achievementsApiRepositoryProvider = Provider<AchievementsApiRepository>((
  ref,
) {
  return AchievementsApiRepository(ref.read(analyticsRemoteDataSourceProvider));
});

final achievementsRepositoryProvider = Provider<AchievementsRepository>((ref) {
  return ref.read(achievementsApiRepositoryProvider);
});

final dailyTasksRepositoryProvider = Provider<DailyTasksRepository>((ref) {
  return DailyTasksApiRepository(ref.read(gamificationRepositoryProvider));
});

final challengeRemoteDataSourceProvider = Provider<ChallengeRemoteDataSource>((
  ref,
) {
  return DioChallengeRemoteDataSource(ref.read(dioClientProvider).dio);
});

final challengeApiRepositoryProvider = Provider<ChallengeApiRepository>((ref) {
  return ChallengeApiRepository(ref.read(challengeRemoteDataSourceProvider));
});

final challengeSocketServiceProvider = Provider<ChallengeSocketService>((ref) {
  final service = ChallengeSocketService(ref.read(tokenStorageProvider));
  ref.onDispose(service.dispose);
  return service;
});

final notificationsRemoteDataSourceProvider =
    Provider<NotificationsRemoteDataSource>((ref) {
      return DioNotificationsRemoteDataSource(ref.read(dioClientProvider).dio);
    });

final notificationsApiRepositoryProvider = Provider<NotificationsApiRepository>(
  (ref) {
    return NotificationsApiRepository(
      ref.read(notificationsRemoteDataSourceProvider),
    );
  },
);

final fcmNotificationServiceProvider = Provider<FcmNotificationService>((ref) {
  final service = FcmNotificationService(
    ref.read(notificationsApiRepositoryProvider),
  );
  ref.onDispose(service.dispose);
  return service;
});
