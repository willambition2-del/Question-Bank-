import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_response.dart';
import '../../../core/network/progress_api_models.dart';
import '../../../core/repositories/providers.dart';

class MistakesState {
  final AsyncValue<List<MistakeRecord>> mistakes;
  final String? selectedSubjectId;
  final PageMeta? meta;
  final bool actionInProgress;

  const MistakesState({
    required this.mistakes,
    this.selectedSubjectId,
    this.meta,
    this.actionInProgress = false,
  });

  MistakesState copyWith({
    AsyncValue<List<MistakeRecord>>? mistakes,
    Object? selectedSubjectId = _unset,
    Object? meta = _unset,
    bool? actionInProgress,
  }) => MistakesState(
    mistakes: mistakes ?? this.mistakes,
    selectedSubjectId: identical(selectedSubjectId, _unset)
        ? this.selectedSubjectId
        : selectedSubjectId as String?,
    meta: identical(meta, _unset) ? this.meta : meta as PageMeta?,
    actionInProgress: actionInProgress ?? this.actionInProgress,
  );
}

const _unset = Object();

class MistakesNotifier extends Notifier<MistakesState> {
  @override
  MistakesState build() {
    Future.microtask(loadMistakes);
    return const MistakesState(mistakes: AsyncValue.loading());
  }

  Future<void> loadMistakes() async {
    state = state.copyWith(mistakes: const AsyncValue.loading());
    try {
      final page = await ref
          .read(mistakesRepositoryProvider)
          .list(subjectId: state.selectedSubjectId);
      state = state.copyWith(
        mistakes: AsyncValue.data(page.items),
        meta: page.meta,
      );
    } catch (error, stackTrace) {
      state = state.copyWith(
        mistakes: AsyncValue.error(error, stackTrace),
        meta: null,
      );
    }
  }

  void selectSubject(String? subjectId) {
    state = state.copyWith(selectedSubjectId: subjectId);
    loadMistakes();
  }

  Future<void> resolveMistake(String questionId) async {
    if (state.actionInProgress) return;
    state = state.copyWith(actionInProgress: true);
    try {
      await ref.read(mistakesRepositoryProvider).markReviewed(questionId);
      await loadMistakes();
    } finally {
      state = state.copyWith(actionInProgress: false);
    }
  }

  void removeMistake(String questionId) {
    if (state.mistakes.hasValue) {
      final currentList = state.mistakes.value!;
      final updatedList =
          currentList.where((m) => m.question.id != questionId).toList();
      state = state.copyWith(mistakes: AsyncValue.data(updatedList));
    }
  }

  List<MistakeRecord> getFilteredMistakes() => state.mistakes.value ?? const [];
}

final mistakesNotifierProvider =
    NotifierProvider<MistakesNotifier, MistakesState>(MistakesNotifier.new);
