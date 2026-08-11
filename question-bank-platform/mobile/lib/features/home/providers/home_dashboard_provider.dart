import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/analytics_api_models.dart';
import '../../../core/repositories/providers.dart';

class HomeDashboardState {
  final AsyncValue<StatisticsOverview> overview;
  final AsyncValue<RecommendationBundle> recommendations;
  final AsyncValue<PointsProfile> points;
  final AsyncValue<List<DailyTask>> dailyTasks;

  const HomeDashboardState({
    required this.overview,
    required this.recommendations,
    required this.points,
    required this.dailyTasks,
  });

  HomeDashboardState copyWith({
    AsyncValue<StatisticsOverview>? overview,
    AsyncValue<RecommendationBundle>? recommendations,
    AsyncValue<PointsProfile>? points,
    AsyncValue<List<DailyTask>>? dailyTasks,
  }) => HomeDashboardState(
    overview: overview ?? this.overview,
    recommendations: recommendations ?? this.recommendations,
    points: points ?? this.points,
    dailyTasks: dailyTasks ?? this.dailyTasks,
  );
}

class HomeDashboardNotifier extends Notifier<HomeDashboardState> {
  @override
  HomeDashboardState build() {
    Future.microtask(load);
    return const HomeDashboardState(
      overview: AsyncValue.loading(),
      recommendations: AsyncValue.loading(),
      points: AsyncValue.loading(),
      dailyTasks: AsyncValue.loading(),
    );
  }

  Future<void> load() async {
    await Future.wait([
      _loadOverview(),
      _loadRecommendations(),
      _loadPoints(),
      _loadDailyTasks(),
    ]);
  }

  Future<void> _loadOverview() async {
    try {
      final value = await ref.read(statisticsRepositoryProvider).overview();
      state = state.copyWith(overview: AsyncValue.data(value));
    } catch (error, stackTrace) {
      state = state.copyWith(overview: AsyncValue.error(error, stackTrace));
    }
  }

  Future<void> _loadRecommendations() async {
    try {
      final value = await ref.read(recommendationsRepositoryProvider).get();
      state = state.copyWith(recommendations: AsyncValue.data(value));
    } catch (error, stackTrace) {
      state = state.copyWith(
        recommendations: AsyncValue.error(error, stackTrace),
      );
    }
  }

  Future<void> _loadPoints() async {
    try {
      final value = await ref.read(gamificationRepositoryProvider).points();
      state = state.copyWith(points: AsyncValue.data(value));
    } catch (error, stackTrace) {
      state = state.copyWith(points: AsyncValue.error(error, stackTrace));
    }
  }

  Future<void> _loadDailyTasks() async {
    try {
      final value = await ref.read(gamificationRepositoryProvider).dailyTasks();
      state = state.copyWith(dailyTasks: AsyncValue.data(value));
    } catch (error, stackTrace) {
      state = state.copyWith(dailyTasks: AsyncValue.error(error, stackTrace));
    }
  }

  Future<void> claimTask(String id) async {
    try {
      await ref.read(gamificationRepositoryProvider).claimDailyTask(id);
      await Future.wait([_loadDailyTasks(), _loadPoints(), _loadOverview()]);
    } catch (_) {
      rethrow;
    }
  }
}

final homeDashboardProvider =
    NotifierProvider<HomeDashboardNotifier, HomeDashboardState>(
      HomeDashboardNotifier.new,
    );
