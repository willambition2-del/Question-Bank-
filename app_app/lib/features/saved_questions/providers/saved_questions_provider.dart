import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_response.dart';
import '../../../core/network/progress_api_models.dart';
import '../../../core/repositories/providers.dart';

class SavedQuestionsState {
  final AsyncValue<List<SavedQuestionRecord>> savedQuestions;
  final String? selectedSubjectId;
  final PageMeta? meta;
  final bool actionInProgress;

  const SavedQuestionsState({
    required this.savedQuestions,
    this.selectedSubjectId,
    this.meta,
    this.actionInProgress = false,
  });

  SavedQuestionsState copyWith({
    AsyncValue<List<SavedQuestionRecord>>? savedQuestions,
    Object? selectedSubjectId = _unset,
    Object? meta = _unset,
    bool? actionInProgress,
  }) => SavedQuestionsState(
    savedQuestions: savedQuestions ?? this.savedQuestions,
    selectedSubjectId: identical(selectedSubjectId, _unset)
        ? this.selectedSubjectId
        : selectedSubjectId as String?,
    meta: identical(meta, _unset) ? this.meta : meta as PageMeta?,
    actionInProgress: actionInProgress ?? this.actionInProgress,
  );
}

const _unset = Object();

class SavedQuestionsNotifier extends Notifier<SavedQuestionsState> {
  @override
  SavedQuestionsState build() {
    Future.microtask(loadSavedQuestions);
    return const SavedQuestionsState(savedQuestions: AsyncValue.loading());
  }

  Future<void> loadSavedQuestions() async {
    state = state.copyWith(savedQuestions: const AsyncValue.loading());
    try {
      final page = await ref
          .read(savedQuestionsRepositoryProvider)
          .list(subjectId: state.selectedSubjectId);
      state = state.copyWith(
        savedQuestions: AsyncValue.data(page.items),
        meta: page.meta,
      );
    } catch (error, stackTrace) {
      state = state.copyWith(
        savedQuestions: AsyncValue.error(error, stackTrace),
        meta: null,
      );
    }
  }

  void selectSubject(String? subjectId) {
    state = state.copyWith(selectedSubjectId: subjectId);
    loadSavedQuestions();
  }

  Future<void> unsaveQuestion(String questionId) async {
    if (state.actionInProgress) return;
    state = state.copyWith(actionInProgress: true);
    try {
      await ref.read(savedQuestionsRepositoryProvider).remove(questionId);
      final current = state.savedQuestions.value ?? const [];
      state = state.copyWith(
        savedQuestions: AsyncValue.data(
          current.where((item) => item.question.id != questionId).toList(),
        ),
      );
    } finally {
      state = state.copyWith(actionInProgress: false);
    }
  }

  Future<void> updateNote(String questionId, String? note) async {
    if (state.actionInProgress) return;
    state = state.copyWith(actionInProgress: true);
    try {
      final updated = await ref
          .read(savedQuestionsRepositoryProvider)
          .updateNote(questionId, note);
      final current = state.savedQuestions.value ?? const [];
      state = state.copyWith(
        savedQuestions: AsyncValue.data([
          for (final item in current)
            if (item.question.id == questionId) updated else item,
        ]),
      );
    } finally {
      state = state.copyWith(actionInProgress: false);
    }
  }

  List<SavedQuestionRecord> getFilteredSavedQuestions() =>
      state.savedQuestions.value ?? const [];
}

final savedQuestionsNotifierProvider =
    NotifierProvider<SavedQuestionsNotifier, SavedQuestionsState>(
      SavedQuestionsNotifier.new,
    );
