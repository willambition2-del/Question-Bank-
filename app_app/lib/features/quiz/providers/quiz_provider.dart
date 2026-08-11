import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/models/reading_passage.dart';
import '../../../core/network/quiz_api_models.dart';
import '../../../core/repositories/providers.dart';
import '../../../core/repositories/quiz_api_repository.dart';

enum QuizQuestionStatus {
  idle,
  loading,
  selected,
  submitting,
  submittedCorrect,
  submittedWrong,
  submittedHidden,
  timedOut,
  showingExplanation,
  completed,
  abandoned,
  error,
}

class QuizState {
  static const _unset = Object();
  final List<QuizQuestion> questions;
  final QuizAttemptSummary? attempt;
  final QuizResult? result;
  final QuizAvailability? availability;
  final int currentIndex;
  final QuizQuestionStatus status;
  final String? selectedOptionId;
  final String? revealedCorrectOptionId;
  final bool? revealedCorrectBoolean;
  final String? explanationShort;
  final String? explanationDetailed;
  final String? selectedOptionWhyWrong;
  final int hearts;
  final int maxHearts;
  final int timerSeconds;
  final int maxTimerSeconds;
  final int totalElapsedTimeSeconds;
  final int correctCount;
  final int wrongCount;
  final int unansweredCount;
  final bool hintUsed;
  final bool eliminationUsed;
  final List<String> eliminatedOptionIds;
  final Map<String, String?> questionAnswers;
  final Map<String, bool> questionSavedStates;
  final String? warningMessage;
  final String? errorMessage;

  const QuizState({
    required this.questions,
    this.attempt,
    this.result,
    this.availability,
    this.currentIndex = 0,
    this.status = QuizQuestionStatus.idle,
    this.selectedOptionId,
    this.revealedCorrectOptionId,
    this.revealedCorrectBoolean,
    this.explanationShort,
    this.explanationDetailed,
    this.selectedOptionWhyWrong,
    this.hearts = -1,
    this.maxHearts = 3,
    this.timerSeconds = -1,
    this.maxTimerSeconds = -1,
    this.totalElapsedTimeSeconds = 0,
    this.correctCount = 0,
    this.wrongCount = 0,
    this.unansweredCount = 0,
    this.hintUsed = false,
    this.eliminationUsed = false,
    this.eliminatedOptionIds = const [],
    this.questionAnswers = const {},
    this.questionSavedStates = const {},
    this.warningMessage,
    this.errorMessage,
  });

  QuizQuestion? get currentQuestion =>
      questions.isEmpty || currentIndex >= questions.length
      ? null
      : questions[currentIndex];
  ReadingPassage? get currentReadingPassage => currentQuestion?.readingPassage;
  bool get isBusy =>
      status == QuizQuestionStatus.loading ||
      status == QuizQuestionStatus.submitting;

  QuizState copyWith({
    List<QuizQuestion>? questions,
    Object? attempt = _unset,
    Object? result = _unset,
    Object? availability = _unset,
    int? currentIndex,
    QuizQuestionStatus? status,
    Object? selectedOptionId = _unset,
    Object? revealedCorrectOptionId = _unset,
    Object? revealedCorrectBoolean = _unset,
    Object? explanationShort = _unset,
    Object? explanationDetailed = _unset,
    Object? selectedOptionWhyWrong = _unset,
    int? hearts,
    int? maxHearts,
    int? timerSeconds,
    int? maxTimerSeconds,
    int? totalElapsedTimeSeconds,
    int? correctCount,
    int? wrongCount,
    int? unansweredCount,
    bool? hintUsed,
    bool? eliminationUsed,
    List<String>? eliminatedOptionIds,
    Map<String, String?>? questionAnswers,
    Map<String, bool>? questionSavedStates,
    Object? warningMessage = _unset,
    Object? errorMessage = _unset,
  }) => QuizState(
    questions: questions ?? this.questions,
    attempt: identical(attempt, _unset)
        ? this.attempt
        : attempt as QuizAttemptSummary?,
    result: identical(result, _unset) ? this.result : result as QuizResult?,
    availability: identical(availability, _unset)
        ? this.availability
        : availability as QuizAvailability?,
    currentIndex: currentIndex ?? this.currentIndex,
    status: status ?? this.status,
    selectedOptionId: identical(selectedOptionId, _unset)
        ? this.selectedOptionId
        : selectedOptionId as String?,
    revealedCorrectOptionId: identical(revealedCorrectOptionId, _unset)
        ? this.revealedCorrectOptionId
        : revealedCorrectOptionId as String?,
    revealedCorrectBoolean: identical(revealedCorrectBoolean, _unset)
        ? this.revealedCorrectBoolean
        : revealedCorrectBoolean as bool?,
    explanationShort: identical(explanationShort, _unset)
        ? this.explanationShort
        : explanationShort as String?,
    explanationDetailed: identical(explanationDetailed, _unset)
        ? this.explanationDetailed
        : explanationDetailed as String?,
    selectedOptionWhyWrong: identical(selectedOptionWhyWrong, _unset)
        ? this.selectedOptionWhyWrong
        : selectedOptionWhyWrong as String?,
    hearts: hearts ?? this.hearts,
    maxHearts: maxHearts ?? this.maxHearts,
    timerSeconds: timerSeconds ?? this.timerSeconds,
    maxTimerSeconds: maxTimerSeconds ?? this.maxTimerSeconds,
    totalElapsedTimeSeconds:
        totalElapsedTimeSeconds ?? this.totalElapsedTimeSeconds,
    correctCount: correctCount ?? this.correctCount,
    wrongCount: wrongCount ?? this.wrongCount,
    unansweredCount: unansweredCount ?? this.unansweredCount,
    hintUsed: hintUsed ?? this.hintUsed,
    eliminationUsed: eliminationUsed ?? this.eliminationUsed,
    eliminatedOptionIds: eliminatedOptionIds ?? this.eliminatedOptionIds,
    questionAnswers: questionAnswers ?? this.questionAnswers,
    questionSavedStates: questionSavedStates ?? this.questionSavedStates,
    warningMessage: identical(warningMessage, _unset)
        ? this.warningMessage
        : warningMessage as String?,
    errorMessage: identical(errorMessage, _unset)
        ? this.errorMessage
        : errorMessage as String?,
  );
}

class QuizNotifier extends Notifier<QuizState> {
  Timer? _timer;
  bool _timerRefreshInFlight = false;

  @override
  QuizState build() {
    ref.onDispose(() => _timer?.cancel());
    Future.microtask(restoreActiveAttempt);
    return const QuizState(questions: []);
  }

  QuizLifecycleRepository get _repository =>
      ref.read(quizLifecycleRepositoryProvider);

  Future<bool> startQuiz({
    String? subjectId,
    String? unitId,
    String? lessonId,
    String? examModelId,
    String? scope,
    required int count,
    required String difficulty,
    required String type,
    required bool useHearts,
    required bool useTimer,
    required int timerLimitSeconds,
    String timingMode = 'perQuestion',
    String explanationMode = 'afterEach',
    bool excludeMastered = false,
    bool unansweredOnly = false,
  }) async {
    if (state.isBusy) return false;
    _timer?.cancel();
    state = const QuizState(questions: [], status: QuizQuestionStatus.loading);
    final inferredScope = examModelId != null
        ? 'EXAM_MODEL'
        : lessonId != null
        ? 'LESSON'
        : unitId != null
        ? 'UNIT'
        : subjectId != null
        ? 'SUBJECT'
        : 'RANDOM';
    final backendScope = scope?.toUpperCase() ?? inferredScope;
    final backendTiming = !useTimer
        ? 'NONE'
        : timingMode == 'totalTime'
        ? 'TOTAL_TIME'
        : 'PER_QUESTION';
    final backendExplanation = explanationMode == 'atEnd'
        ? 'AT_END'
        : explanationMode == 'none'
        ? 'DISABLED'
        : 'AFTER_EACH';
    final questionTypes = type == 'mcq'
        ? const ['MULTIPLE_CHOICE']
        : type == 'trueFalse'
        ? const ['TRUE_FALSE']
        : null;
    try {
      final request = QuizCreateRequest(
        scope: backendScope,
        subjectId: subjectId,
        unitId: unitId,
        lessonId: lessonId,
        examModelId: examModelId,
        questionCount: count,
        questionTypes: questionTypes,
        difficulty: difficulty.toUpperCase(),
        timingMode: backendTiming,
        durationSeconds: backendTiming == 'TOTAL_TIME'
            ? timerLimitSeconds
            : null,
        timePerQuestionSeconds: backendTiming == 'PER_QUESTION'
            ? timerLimitSeconds
            : null,
        heartsEnabled: useHearts,
        initialHearts: 3,
        hintsEnabled: true,
        eliminationEnabled: false,
        explanationMode: backendExplanation,
        excludeMastered: excludeMastered,
        unansweredOnly: unansweredOnly,
      );
      final pendingStart = switch (backendScope) {
        'MISTAKES' => ref.read(mistakesRepositoryProvider).createQuiz(request),
        'SAVED' =>
          ref.read(savedQuestionsRepositoryProvider).createQuiz(request),
        _ => _repository.create(request),
      };
      final response = await pendingStart;
      await ref.read(activeAttemptStorageProvider).save(response.attempt.id);
      _applyStart(response);
      return true;
    } catch (error) {
      state = QuizState(
        questions: const [],
        status: QuizQuestionStatus.error,
        errorMessage: _message(error),
      );
      return false;
    }
  }

  void _applyStart(QuizStartResponse response) {
    final perQuestion = response.attempt.timePerQuestionSeconds;
    final totalRemaining = response.attempt.expiresAt
        ?.difference(DateTime.now().toUtc())
        .inSeconds;
    final timerSeconds = response.attempt.timingMode == 'PER_QUESTION'
        ? perQuestion ?? -1
        : response.attempt.timingMode == 'TOTAL_TIME'
        ? (totalRemaining ?? -1).clamp(0, 21600)
        : -1;
    final firstUnanswered = response.questions.indexWhere(
      (item) => !item.answered,
    );
    state = QuizState(
      questions: response.questions,
      currentIndex: firstUnanswered < 0 ? 0 : firstUnanswered,
      attempt: response.attempt,
      availability: response.availability,
      status: QuizQuestionStatus.idle,
      hearts: response.attempt.heartsRemaining ?? -1,
      maxHearts: 3,
      timerSeconds: timerSeconds,
      maxTimerSeconds: timerSeconds,
      correctCount: response.attempt.correctCount,
      wrongCount: response.attempt.wrongCount,
      unansweredCount: response.attempt.unansweredCount,
      warningMessage: response.availability.isPartial
          ? 'توفر عدد أقل من الأسئلة المناسبة، وسيبدأ الاختبار بالأسئلة المتاحة.'
          : null,
    );
    if (timerSeconds >= 0) _startTickTimer();
  }

  Future<void> restoreActiveAttempt() async {
    final id = await ref.read(activeAttemptStorageProvider).read();
    if (id == null || state.questions.isNotEmpty) return;
    try {
      final response = await _repository.getAttempt(id);
      if (response.attempt.status == 'IN_PROGRESS') {
        _applyStart(response);
      } else if (response.attempt.status == 'COMPLETED') {
        await _loadResult(id);
      } else {
        await ref.read(activeAttemptStorageProvider).clear();
      }
    } catch (_) {
      await ref.read(activeAttemptStorageProvider).clear();
    }
  }

  void _startTickTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (state.timerSeconds < 0 ||
          state.isBusy ||
          _isAnsweredStatus(state.status)) {
        return;
      }
      if (state.timerSeconds > 0) {
        state = state.copyWith(
          timerSeconds: state.timerSeconds - 1,
          totalElapsedTimeSeconds: state.totalElapsedTimeSeconds + 1,
        );
      } else {
        _timer?.cancel();
        _refreshAfterTimer();
      }
    });
  }

  Future<void> _refreshAfterTimer() async {
    if (_timerRefreshInFlight || state.attempt == null) return;
    _timerRefreshInFlight = true;
    try {
      final response = await _repository.getAttempt(state.attempt!.id);
      if (response.attempt.status == 'EXPIRED') {
        state = state.copyWith(
          attempt: response.attempt,
          status: QuizQuestionStatus.timedOut,
          errorMessage: 'انتهى الوقت المعتمد من الخادم.',
        );
        await ref.read(activeAttemptStorageProvider).clear();
      } else {
        _applyStart(response);
      }
    } catch (error) {
      final code = error is ApiException ? error.backendCode : null;
      if (code == 'QUIZ_ATTEMPT_EXPIRED' ||
          code == 'QUIZ_QUESTION_TIME_EXPIRED') {
        state = state.copyWith(
          status: QuizQuestionStatus.timedOut,
          errorMessage: _message(error),
        );
        await ref.read(activeAttemptStorageProvider).clear();
      } else {
        state = state.copyWith(errorMessage: _message(error));
      }
    } finally {
      _timerRefreshInFlight = false;
    }
  }

  void selectOption(String optionId) {
    if (state.isBusy || _isAnsweredStatus(state.status)) {
      return;
    }
    state = state.copyWith(
      selectedOptionId: optionId,
      status: QuizQuestionStatus.selected,
      errorMessage: null,
    );
  }

  Future<void> submitAnswer() async {
    final question = state.currentQuestion;
    final selection = state.selectedOptionId;
    final attempt = state.attempt;
    if (question == null ||
        selection == null ||
        attempt == null ||
        state.isBusy ||
        _isAnsweredStatus(state.status)) {
      return;
    }
    state = state.copyWith(
      status: QuizQuestionStatus.submitting,
      errorMessage: null,
    );
    try {
      final response = await _repository.answer(
        attempt.id,
        question: question,
        selection: selection,
        timeSpentMs: state.totalElapsedTimeSeconds * 1000,
        hintUsed: state.hintUsed,
        eliminatedOptionUsed: state.eliminationUsed,
      );
      final answers = Map<String, String?>.from(state.questionAnswers)
        ..[question.id] = selection;
      final status = response.isCorrect == true
          ? QuizQuestionStatus.submittedCorrect
          : response.isCorrect == false
          ? QuizQuestionStatus.submittedWrong
          : QuizQuestionStatus.submittedHidden;
      state = state.copyWith(
        status: status,
        revealedCorrectOptionId: response.correctOptionId,
        revealedCorrectBoolean: response.correctBoolean,
        explanationShort: response.explanationShort,
        explanationDetailed: response.explanationDetailed,
        selectedOptionWhyWrong: response.selectedOptionWhyWrong,
        hearts: response.heartsRemaining ?? -1,
        correctCount: response.correct,
        wrongCount: response.wrong,
        unansweredCount: response.remaining,
        questionAnswers: answers,
      );
      if (response.status == 'COMPLETED') await _loadResult(attempt.id);
    } catch (error) {
      state = state.copyWith(
        status: QuizQuestionStatus.selected,
        errorMessage: _message(error),
      );
    }
  }

  Future<void> nextQuestion() async {
    if (!_isAnsweredStatus(state.status) || state.attempt == null) return;
    _timer?.cancel();
    if (state.currentIndex + 1 >= state.questions.length) {
      await completeQuiz();
      return;
    }
    final timer = state.attempt!.timingMode == 'PER_QUESTION'
        ? state.attempt!.timePerQuestionSeconds ?? -1
        : state.timerSeconds;
    state = state.copyWith(
      currentIndex: state.currentIndex + 1,
      status: QuizQuestionStatus.idle,
      selectedOptionId: null,
      revealedCorrectOptionId: null,
      revealedCorrectBoolean: null,
      explanationShort: null,
      explanationDetailed: null,
      selectedOptionWhyWrong: null,
      hintUsed: false,
      eliminationUsed: false,
      eliminatedOptionIds: const [],
      timerSeconds: timer,
      totalElapsedTimeSeconds: 0,
    );
    if (timer >= 0) _startTickTimer();
  }

  Future<void> completeQuiz() async {
    final id = state.attempt?.id;
    if (id == null || state.status == QuizQuestionStatus.completed) return;
    state = state.copyWith(status: QuizQuestionStatus.loading);
    try {
      final attempt = await _repository.complete(id);
      state = state.copyWith(attempt: attempt);
      await _loadResult(id);
    } catch (error) {
      state = state.copyWith(
        status: QuizQuestionStatus.error,
        errorMessage: _message(error),
      );
    }
  }

  Future<void> _loadResult(String id) async {
    _timer?.cancel();
    final result = await _repository.getResult(id);
    await ref.read(activeAttemptStorageProvider).clear();
    state = state.copyWith(
      attempt: result.summary,
      result: result,
      status: QuizQuestionStatus.completed,
    );
  }

  Future<void> cancelQuiz() async {
    _timer?.cancel();
    final id = state.attempt?.id;
    if (id != null && state.attempt?.status == 'IN_PROGRESS') {
      try {
        await _repository.abandon(id);
      } catch (_) {}
    }
    await ref.read(activeAttemptStorageProvider).clear();
    state = const QuizState(
      questions: [],
      status: QuizQuestionStatus.abandoned,
    );
  }

  void previousQuestion() {}
  void showExplanation() =>
      state = state.copyWith(status: QuizQuestionStatus.showingExplanation);
  void useHint() => state = state.copyWith(hintUsed: true);
  void eliminateOption() => state = state.copyWith(eliminationUsed: true);

  Future<void> toggleSaveCurrentQuestion() async {
    final question = state.currentQuestion;
    if (question == null) return;
    final saved = state.questionSavedStates[question.id] ?? false;
    if (saved) {
      await ref.read(savedQuestionsRepositoryProvider).remove(question.id);
    } else {
      await ref.read(savedQuestionsRepositoryProvider).save(question.id);
    }
    state = state.copyWith(
      questionSavedStates: {...state.questionSavedStates, question.id: !saved},
    );
  }

  void resetQuiz() {}

  bool _isAnsweredStatus(QuizQuestionStatus value) =>
      value == QuizQuestionStatus.submittedCorrect ||
      value == QuizQuestionStatus.submittedWrong ||
      value == QuizQuestionStatus.submittedHidden ||
      value == QuizQuestionStatus.showingExplanation;

  String _message(Object error) => quizErrorMessage(error);
}

String quizErrorMessage(Object error) {
  final code = error is ApiException ? error.backendCode : null;
  return switch (code) {
    'INSUFFICIENT_QUESTIONS' => 'لا توجد أسئلة مناسبة لهذا الاختبار حاليًا.',
    'QUESTION_ALREADY_ANSWERED' => 'تم إرسال إجابة مختلفة لهذا السؤال مسبقًا.',
    'QUIZ_ATTEMPT_EXPIRED' => 'انتهى وقت الاختبار.',
    'QUIZ_QUESTION_TIME_EXPIRED' => 'انتهى وقت السؤال وفق توقيت الخادم.',
    'QUIZ_OPTION_NOT_IN_QUESTION' => 'الخيار المحدد غير متاح لهذا السؤال.',
    'QUIZ_ANSWER_TYPE_INVALID' => 'صيغة الإجابة غير متوافقة مع نوع السؤال.',
    'QUIZ_ATTEMPT_NOT_ACTIVE' => 'هذه المحاولة لم تعد نشطة.',
    _ =>
      error is ApiException
          ? error.userMessage
          : 'تعذر إكمال العملية. حاول مجددًا.',
  };
}

final quizNotifierProvider = NotifierProvider<QuizNotifier, QuizState>(
  QuizNotifier.new,
);
