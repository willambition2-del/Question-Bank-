import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/analytics_api_models.dart';
import '../../../core/repositories/providers.dart';

class StatisticsDashboardState {
  final String range;
  final DateTime? from;
  final DateTime? to;
  final AsyncValue<StatisticsOverview> overview;
  final AsyncValue<List<AccuracyTrendPoint>> trend;
  final AsyncValue<List<HeatmapPoint>> heatmap;
  final AsyncValue<List<ProgressMetric>> subjects;
  final AsyncValue<QuestionAnalytics> questions;
  final AsyncValue<RecommendationBundle> recommendations;

  const StatisticsDashboardState({
    this.range = 'week',
    this.from,
    this.to,
    required this.overview,
    required this.trend,
    required this.heatmap,
    required this.subjects,
    required this.questions,
    required this.recommendations,
  });

  StatisticsDashboardState copyWith({
    String? range,
    Object? from = _unset,
    Object? to = _unset,
    AsyncValue<StatisticsOverview>? overview,
    AsyncValue<List<AccuracyTrendPoint>>? trend,
    AsyncValue<List<HeatmapPoint>>? heatmap,
    AsyncValue<List<ProgressMetric>>? subjects,
    AsyncValue<QuestionAnalytics>? questions,
    AsyncValue<RecommendationBundle>? recommendations,
  }) => StatisticsDashboardState(
    range: range ?? this.range,
    from: identical(from, _unset) ? this.from : from as DateTime?,
    to: identical(to, _unset) ? this.to : to as DateTime?,
    overview: overview ?? this.overview,
    trend: trend ?? this.trend,
    heatmap: heatmap ?? this.heatmap,
    subjects: subjects ?? this.subjects,
    questions: questions ?? this.questions,
    recommendations: recommendations ?? this.recommendations,
  );
}

class StatisticsDashboardNotifier extends Notifier<StatisticsDashboardState> {
  @override
  StatisticsDashboardState build() {
    Future.microtask(load);
    return const StatisticsDashboardState(
      overview: AsyncValue.loading(),
      trend: AsyncValue.loading(),
      heatmap: AsyncValue.loading(),
      subjects: AsyncValue.loading(),
      questions: AsyncValue.loading(),
      recommendations: AsyncValue.loading(),
    );
  }

  Future<void> setRange(String range) async {
    state = state.copyWith(
      range: range,
      from: null,
      to: null,
      overview: const AsyncValue.loading(),
      trend: const AsyncValue.loading(),
      heatmap: const AsyncValue.loading(),
      questions: const AsyncValue.loading(),
    );
    await load();
  }

  Future<void> setCustomRange(DateTime from, DateTime to) async {
    if (from.isAfter(to)) {
      throw ArgumentError('from must be before or equal to to');
    }
    state = state.copyWith(
      range: 'custom',
      from: from,
      to: to,
      overview: const AsyncValue.loading(),
      trend: const AsyncValue.loading(),
      heatmap: const AsyncValue.loading(),
      questions: const AsyncValue.loading(),
    );
    await load();
  }

  Future<void> load() async {
    final range = state.range == 'custom' ? 'all' : state.range;
    final from = state.from;
    final to = state.to;
    await Future.wait([
      _capture(
        () => ref
            .read(statisticsRepositoryProvider)
            .overview(range: range, from: from, to: to),
        (value) => state = state.copyWith(overview: value),
      ),
      _capture(
        () => ref
            .read(statisticsRepositoryProvider)
            .accuracyTrend(range: range, from: from, to: to),
        (value) => state = state.copyWith(trend: value),
      ),
      _capture(
        () => ref
            .read(statisticsRepositoryProvider)
            .heatmap(range: range, from: from, to: to),
        (value) => state = state.copyWith(heatmap: value),
      ),
      _capture(
        () => ref.read(statisticsRepositoryProvider).subjects(),
        (value) => state = state.copyWith(subjects: value),
      ),
      _capture(
        () => ref
            .read(statisticsRepositoryProvider)
            .questions(range: range, from: from, to: to),
        (value) => state = state.copyWith(questions: value),
      ),
      _capture(
        () => ref.read(recommendationsRepositoryProvider).get(),
        (value) => state = state.copyWith(recommendations: value),
      ),
    ]);
  }

  Future<void> _capture<T>(
    Future<T> Function() request,
    void Function(AsyncValue<T>) set,
  ) async {
    try {
      set(AsyncValue.data(await request()));
    } catch (error, stackTrace) {
      set(AsyncValue.error(error, stackTrace));
    }
  }
}

const _unset = Object();

final statisticsDashboardProvider =
    NotifierProvider<StatisticsDashboardNotifier, StatisticsDashboardState>(
      StatisticsDashboardNotifier.new,
    );
