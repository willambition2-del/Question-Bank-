import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/repositories/providers.dart';
import '../domain/assistant_models.dart';

enum AssistantUiStatus {
  idle,
  uploading,
  processing,
  streaming,
  completed,
  insufficientContext,
  limitReached,
  temporarilyUnavailable,
  retry,
}

final class AssistantState {
  final AssistantUiStatus status;
  final AssistantResponse? response;
  final ImageQuestionAnalysisResponse? imageResponse;
  final double uploadProgress;
  final String? errorMessage;
  final AssistantAction? lastAction;
  final Map<String, String> lastArguments;
  final AssistantUsageInfo? usage;
  final bool isLoadingUsage;

  const AssistantState({
    this.status = AssistantUiStatus.idle,
    this.response,
    this.imageResponse,
    this.uploadProgress = 0,
    this.errorMessage,
    this.lastAction,
    this.lastArguments = const {},
    this.usage,
    this.isLoadingUsage = false,
  });

  bool get isLimitReached =>
      usage?.isLimitReached == true || status == AssistantUiStatus.limitReached;
  bool get isAssistantDisabled =>
      usage?.enabled == false || status == AssistantUiStatus.temporarilyUnavailable;

  AssistantState copyWith({
    AssistantUiStatus? status,
    AssistantResponse? response,
    ImageQuestionAnalysisResponse? imageResponse,
    double? uploadProgress,
    String? errorMessage,
    AssistantAction? lastAction,
    Map<String, String>? lastArguments,
    AssistantUsageInfo? usage,
    bool? isLoadingUsage,
  }) =>
      AssistantState(
        status: status ?? this.status,
        response: response ?? this.response,
        imageResponse: imageResponse ?? this.imageResponse,
        uploadProgress: uploadProgress ?? this.uploadProgress,
        errorMessage: errorMessage,
        lastAction: lastAction ?? this.lastAction,
        lastArguments: lastArguments ?? this.lastArguments,
        usage: usage ?? this.usage,
        isLoadingUsage: isLoadingUsage ?? this.isLoadingUsage,
      );
}

final class AssistantNotifier extends Notifier<AssistantState> {
  @override
  AssistantState build() {
    Future.microtask(loadUsage);
    return const AssistantState();
  }

  Future<void> loadUsage() async {
    state = state.copyWith(isLoadingUsage: true);
    try {
      final usage = await ref.read(assistantRepositoryProvider).getUsage();
      state = state.copyWith(usage: usage, isLoadingUsage: false);
    } catch (_) {
      state = state.copyWith(isLoadingUsage: false);
    }
  }

  Future<void> chat(String message) =>
      _run(AssistantAction.chat, {'message': message});

  Future<void> analyzeImage({
    required Uint8List bytes,
    required String fileName,
    required ImageAnalysisMode mode,
    String? userQuestion,
  }) async {
    if (state.status == AssistantUiStatus.uploading ||
        state.status == AssistantUiStatus.processing) {
      return;
    }
    state = state.copyWith(status: AssistantUiStatus.uploading);
    try {
      final response = await ref
          .read(assistantRepositoryProvider)
          .analyzeQuestionImage(
            bytes: bytes,
            fileName: fileName,
            mode: mode,
            userQuestion: userQuestion,
            onSendProgress: (sent, total) {
              if (total <= 0) return;
              state = state.copyWith(
                status: sent < total
                    ? AssistantUiStatus.uploading
                    : AssistantUiStatus.processing,
                uploadProgress: sent / total,
              );
            },
          );
      state = state.copyWith(
        status: AssistantUiStatus.completed,
        imageResponse: response,
      );
    } catch (error) {
      state = state.copyWith(
        status: _errorStatus(error),
        errorMessage: _errorMessage(error),
      );
    }
  }

  Future<void> summarizeLesson(String lessonId) =>
      _run(AssistantAction.summarizeLesson, {'lessonId': lessonId});

  Future<void> simplifyLesson(String lessonId) =>
      _run(AssistantAction.simplifyLesson, {'lessonId': lessonId});

  Future<void> questionHint(String questionId, String attemptId) => _run(
    AssistantAction.hint,
    {'questionId': questionId, 'attemptId': attemptId},
  );

  Future<void> explainQuestion(String questionId, String attemptId) => _run(
    AssistantAction.explain,
    {'questionId': questionId, 'attemptId': attemptId},
  );

  Future<void> retryLast() async {
    final action = state.lastAction;
    if (action == null) return;
    await _run(action, state.lastArguments);
  }

  Future<void> _run(
    AssistantAction action,
    Map<String, String> arguments,
  ) async {
    if (state.status == AssistantUiStatus.processing) return;
    final trimmed = {
      for (final entry in arguments.entries) entry.key: entry.value.trim(),
    };
    if (trimmed.values.any((value) => value.isEmpty)) return;
    state = state.copyWith(
      status: AssistantUiStatus.processing,
      lastAction: action,
      lastArguments: trimmed,
    );
    try {
      final repository = ref.read(assistantRepositoryProvider);
      final response = switch (action) {
        AssistantAction.chat => await repository.chat(trimmed['message']!),
        AssistantAction.hint => await repository.questionHint(
          questionId: trimmed['questionId']!,
          attemptId: trimmed['attemptId']!,
        ),
        AssistantAction.explain => await repository.explainQuestion(
          questionId: trimmed['questionId']!,
          attemptId: trimmed['attemptId']!,
        ),
        AssistantAction.reviewAnswer => await repository.reviewAnswer(
          questionId: trimmed['questionId']!,
          attemptId: trimmed['attemptId']!,
        ),
        AssistantAction.summarizeLesson => await repository.summarizeLesson(
          trimmed['lessonId']!,
        ),
        AssistantAction.simplifyLesson => await repository.simplifyLesson(
          trimmed['lessonId']!,
        ),
        AssistantAction.askKnowledge => throw const ValidationFailure(),
        AssistantAction.analyzeImage => throw const ValidationFailure(),
      };

      // Optimistically update usage info
      AssistantUsageInfo? updatedUsage = state.usage;
      if (updatedUsage != null && response.used != null) {
        updatedUsage = updatedUsage.copyWith(
          used: response.used,
          remaining: response.remaining,
          limit: response.limit,
          resetPeriod: response.resetPeriod,
          resetAt: response.resetAt,
        );
      } else if (updatedUsage != null && !updatedUsage.isUnlimited) {
        final newUsed = updatedUsage.used + 1;
        final newRemaining = math.max(0, updatedUsage.limit - newUsed);
        updatedUsage = updatedUsage.copyWith(
          used: newUsed,
          remaining: newRemaining,
        );
      }

      state = state.copyWith(
        status: response.hasSufficientContext
            ? AssistantUiStatus.completed
            : AssistantUiStatus.insufficientContext,
        response: response,
        lastAction: action,
        lastArguments: trimmed,
        usage: updatedUsage,
      );
    } catch (error) {
      AssistantUsageInfo? updatedUsage = state.usage;
      if (_errorStatus(error) == AssistantUiStatus.limitReached &&
          updatedUsage != null) {
        updatedUsage = updatedUsage.copyWith(remaining: 0);
      }

      state = state.copyWith(
        status: _errorStatus(error),
        errorMessage: _errorMessage(error),
        lastAction: action,
        lastArguments: trimmed,
        usage: updatedUsage,
      );
    }
  }

  AssistantUiStatus _errorStatus(Object error) {
    if (error is RateLimited ||
        (error is ApiException && error.statusCode == 429)) {
      return AssistantUiStatus.limitReached;
    }
    if (error is ServerFailure &&
        (error.statusCode == 502 || error.statusCode == 503)) {
      return AssistantUiStatus.temporarilyUnavailable;
    }
    if (error is ApiException && error.backendCode == 'AI_ASSISTANT_DISABLED') {
      return AssistantUiStatus.temporarilyUnavailable;
    }
    return AssistantUiStatus.retry;
  }

  String _errorMessage(Object error) {
    if (error is ApiException && error.backendCode == 'AI_MESSAGE_LIMIT_REACHED') {
      return error.userMessage;
    }
    if (error is ApiException && error.backendCode == 'AI_ASSISTANT_DISABLED') {
      return 'المساعد الذكي غير متاح حاليًا.';
    }
    return switch (_errorStatus(error)) {
      AssistantUiStatus.limitReached =>
        'لقد وصلت إلى الحد المسموح للمساعد الذكي.',
      AssistantUiStatus.temporarilyUnavailable =>
        'المساعد غير متاح حاليًا.',
      _ =>
        error is ApiException
            ? error.userMessage
            : 'تعذر إكمال الطلب. تحقق من الاتصال ثم أعد المحاولة.',
    };
  }
}

final assistantProvider = NotifierProvider<AssistantNotifier, AssistantState>(
  AssistantNotifier.new,
);
