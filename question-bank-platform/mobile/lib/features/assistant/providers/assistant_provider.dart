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

  const AssistantState({
    this.status = AssistantUiStatus.idle,
    this.response,
    this.imageResponse,
    this.uploadProgress = 0,
    this.errorMessage,
    this.lastAction,
    this.lastArguments = const {},
  });
}

final class AssistantNotifier extends Notifier<AssistantState> {
  @override
  AssistantState build() => const AssistantState();

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
    state = const AssistantState(status: AssistantUiStatus.uploading);
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
              state = AssistantState(
                status: sent < total
                    ? AssistantUiStatus.uploading
                    : AssistantUiStatus.processing,
                uploadProgress: sent / total,
              );
            },
          );
      state = AssistantState(
        status: AssistantUiStatus.completed,
        imageResponse: response,
      );
    } catch (error) {
      state = AssistantState(
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
    state = AssistantState(
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
      state = AssistantState(
        status: response.hasSufficientContext
            ? AssistantUiStatus.completed
            : AssistantUiStatus.insufficientContext,
        response: response,
        lastAction: action,
        lastArguments: trimmed,
      );
    } catch (error) {
      state = AssistantState(
        status: _errorStatus(error),
        errorMessage: _errorMessage(error),
        lastAction: action,
        lastArguments: trimmed,
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
    return AssistantUiStatus.retry;
  }

  String _errorMessage(Object error) => switch (_errorStatus(error)) {
    AssistantUiStatus.limitReached =>
      'وصلت إلى الحد المتاح حاليًا. جرّب مرة أخرى لاحقًا.',
    AssistantUiStatus.temporarilyUnavailable =>
      'المساعد غير متاح مؤقتًا. حاول بعد قليل.',
    _ =>
      error is ApiException
          ? error.userMessage
          : 'تعذر إكمال الطلب. تحقق من الاتصال ثم أعد المحاولة.',
  };
}

final assistantProvider = NotifierProvider<AssistantNotifier, AssistantState>(
  AssistantNotifier.new,
);
