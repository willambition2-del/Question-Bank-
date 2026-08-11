import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../app/router/tab_index_provider.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_bottom_navigation.dart';
import 'home_screen.dart';
import '../../subjects/presentation/subjects_screen.dart';
import '../../challenges/presentation/challenges_screen.dart';
import '../../statistics/presentation/statistics_screen.dart';
import '../../profile/presentation/profile_screen.dart';

class MainShellScreen extends ConsumerWidget {
  const MainShellScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activeTab = ref.watch(tabIndexProvider);

    return AppScaffold(
      useSafeArea: true,
      body: IndexedStack(
        index: activeTab.clamp(0, 4),
        children: const [
          HomeScreen(),
          SubjectsScreen(),
          ChallengesScreen(),
          StatisticsScreen(),
          ProfileScreen(),
        ],
      ),
      bottomNavigationBar: AppBottomNavigation(
        currentIndex: activeTab.clamp(0, 4),
        onTap: (index) {
          ref.read(tabIndexProvider.notifier).setIndex(index);
        },
      ),
    );
  }
}
