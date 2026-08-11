import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/models/subject_model.dart';
import '../../../core/widgets/subject_card.dart';
import '../../../core/widgets/loading_skeleton.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/error_state.dart';
import '../../../core/models/companion_enums.dart';
import '../providers/subjects_provider.dart';

class SubjectsScreen extends ConsumerStatefulWidget {
  const SubjectsScreen({super.key});

  @override
  ConsumerState<SubjectsScreen> createState() => _SubjectsScreenState();
}

class _SubjectsScreenState extends ConsumerState<SubjectsScreen> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _showFilterModal(BuildContext context) {
    final notifier = ref.read(subjectsNotifierProvider.notifier);
    final activeFilter = ref.read(subjectsNotifierProvider).activeFilter;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE2E8F0),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  "تصفية وترتيب المواد",
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                    fontFamily: 'Cairo',
                  ),
                ),
                const SizedBox(height: 16),
                _buildFilterTile(
                  title: "جميع المواد",
                  icon: Icons.all_inclusive_rounded,
                  filterKey: "all",
                  activeKey: activeFilter,
                  onSelect: () {
                    notifier.setFilter("all");
                    Navigator.pop(context);
                  },
                ),
                _buildFilterTile(
                  title: "المفضلة ⭐",
                  icon: Icons.star_rounded,
                  filterKey: "favorites",
                  activeKey: activeFilter,
                  onSelect: () {
                    notifier.setFilter("favorites");
                    Navigator.pop(context);
                  },
                ),
                _buildFilterTile(
                  title: "الأعلى تقدمًا",
                  icon: Icons.trending_up_rounded,
                  filterKey: "highProgress",
                  activeKey: activeFilter,
                  onSelect: () {
                    notifier.setFilter("highProgress");
                    Navigator.pop(context);
                  },
                ),
                _buildFilterTile(
                  title: "الأقل تقدمًا",
                  icon: Icons.trending_down_rounded,
                  filterKey: "lowProgress",
                  activeKey: activeFilter,
                  onSelect: () {
                    notifier.setFilter("lowProgress");
                    Navigator.pop(context);
                  },
                ),
                _buildFilterTile(
                  title: "الأضعف إتقانًا 🎯",
                  icon: Icons.track_changes_rounded,
                  filterKey: "weakest",
                  activeKey: activeFilter,
                  onSelect: () {
                    notifier.setFilter("weakest");
                    Navigator.pop(context);
                  },
                ),
                const SizedBox(height: 12),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildFilterTile({
    required String title,
    required IconData icon,
    required String filterKey,
    required String activeKey,
    required VoidCallback onSelect,
  }) {
    final isSelected = activeKey == filterKey;
    return ListTile(
      onTap: onSelect,
      leading: Icon(
        icon,
        color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF64748B),
      ),
      title: Text(
        title,
        style: TextStyle(
          fontSize: 15,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
          color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF1E293B),
          fontFamily: 'Cairo',
        ),
      ),
      trailing: isSelected
          ? const Icon(Icons.check_circle_rounded, color: Color(0xFF2563EB))
          : null,
    );
  }

  Widget _buildFilterChip({
    required String label,
    required String filterKey,
    required String activeFilter,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    final isSelected = activeFilter == filterKey;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF2563EB) : Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: isSelected
                ? const Color(0xFF2563EB)
                : const Color(0xFFE2E8F0),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF0F172A).withOpacity(0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                color: isSelected ? Colors.white : const Color(0xFF475569),
                fontFamily: 'Cairo',
              ),
            ),
            const SizedBox(width: 6),
            Icon(
              icon,
              size: 15,
              color: isSelected
                  ? Colors.white
                  : (filterKey == "favorites"
                        ? const Color(0xFFF59E0B)
                        : const Color(0xFF64748B)),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final subjectsState = ref.watch(subjectsNotifierProvider);
    final notifier = ref.read(subjectsNotifierProvider.notifier);
    final filteredSubjects = notifier.getFilteredSubjects();

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Stack(
        children: [
          // Background subtle top-left ambient light decoration
          Positioned(
            top: -40,
            left: -40,
            child: Container(
              width: 180,
              height: 180,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFF0EA5E9).withOpacity(0.15),
                    Colors.white.withOpacity(0.0),
                  ],
                ),
              ),
            ),
          ),

          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 8),

              // --- TOP HEADER (Title, Subtitle & Bell Icon) ---
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text(
                          "المواد الدراسية",
                          style: TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A),
                            fontFamily: 'Cairo',
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          "اختر المادة لمراجعة الوحدات والدروس وتتبع مستوى الإتقان",
                          style: TextStyle(
                            fontSize: 13,
                            color: Color(0xFF64748B),
                            fontFamily: 'Cairo',
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Bell Icon with notification badge
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF0F172A).withOpacity(0.04),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.notifications_outlined,
                          color: Color(0xFF1E293B),
                          size: 22,
                        ),
                      ),
                      Positioned(
                        top: 2,
                        left: 2,
                        child: Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                            color: const Color(0xFF2563EB),
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 2),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // --- SEARCH FIELD + FILTER BUTTON ROW ---
              Row(
                children: [
                  // Filter Button ("تصفية") on the Left
                  GestureDetector(
                    onTap: () => _showFilterModal(context),
                    child: Container(
                      height: 48,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF0F172A).withOpacity(0.04),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        children: const [
                          Icon(
                            Icons.tune_rounded,
                            color: Color(0xFF2563EB),
                            size: 18,
                          ),
                          SizedBox(width: 6),
                          Text(
                            "تصفية",
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF2563EB),
                              fontFamily: 'Cairo',
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),

                  // Search Field on the Right
                  Expanded(
                    child: Container(
                      height: 48,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF0F172A).withOpacity(0.04),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: TextField(
                        controller: _searchController,
                        onChanged: (val) => notifier.setSearchQuery(val),
                        style: const TextStyle(
                          fontSize: 14,
                          color: Color(0xFF0F172A),
                          fontFamily: 'Cairo',
                        ),
                        decoration: InputDecoration(
                          hintText: "ابحث عن مادة أو وحدة أو درس...",
                          hintStyle: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF94A3B8),
                            fontFamily: 'Cairo',
                          ),
                          suffixIcon: const Icon(
                            Icons.search_rounded,
                            color: Color(0xFF64748B),
                            size: 20,
                          ),
                          prefixIcon: _searchController.text.isNotEmpty
                              ? IconButton(
                                  icon: const Icon(
                                    Icons.clear_rounded,
                                    color: Color(0xFF64748B),
                                    size: 18,
                                  ),
                                  onPressed: () {
                                    _searchController.clear();
                                    notifier.setSearchQuery("");
                                  },
                                )
                              : null,
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(
                            vertical: 13,
                            horizontal: 14,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // --- FILTER PILLS / CHIPS ROW ---
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                child: Row(
                  children: [
                    _buildFilterChip(
                      label: "الكل",
                      filterKey: "all",
                      activeFilter: subjectsState.activeFilter,
                      icon: Icons.check_rounded,
                      onTap: () => notifier.setFilter("all"),
                    ),
                    const SizedBox(width: 8),
                    _buildFilterChip(
                      label: "المفضلة",
                      filterKey: "favorites",
                      activeFilter: subjectsState.activeFilter,
                      icon: Icons.star_rounded,
                      onTap: () => notifier.setFilter("favorites"),
                    ),
                    const SizedBox(width: 8),
                    _buildFilterChip(
                      label: "الأعلى تقدمًا",
                      filterKey: "highProgress",
                      activeFilter: subjectsState.activeFilter,
                      icon: Icons.trending_up_rounded,
                      onTap: () => notifier.setFilter("highProgress"),
                    ),
                    const SizedBox(width: 8),
                    _buildFilterChip(
                      label: "الأقل تقدمًا",
                      filterKey: "lowProgress",
                      activeFilter: subjectsState.activeFilter,
                      icon: Icons.trending_down_rounded,
                      onTap: () => notifier.setFilter("lowProgress"),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // --- SUBJECTS LIST ---
              Expanded(
                child: subjectsState.subjects.when(
                  loading: () => LoadingSkeleton.list(itemCount: 4),
                  error: (err, stack) => ErrorState(
                    message: "تعذر تحميل قائمة المواد الدراسية.",
                    onRetry: () => notifier.loadSubjects(),
                  ),
                  data: (_) {
                    if (filteredSubjects.isEmpty) {
                      return const EmptyState(
                        title: "لا توجد مواد مطابقة",
                        message:
                            "جرّب تغيير عبارة البحث أو الفلتر المعتمد لمشاهدة جميع المواد المتاحة.",
                        emotion: CharacterEmotion.thinking,
                      );
                    }
                    return ListView.builder(
                      itemCount: filteredSubjects.length,
                      physics: const BouncingScrollPhysics(),
                      padding: const EdgeInsets.only(bottom: 20),
                      itemBuilder: (context, index) {
                        final subject = filteredSubjects[index];
                        return SubjectCard(
                          subjectId: subject.id,
                          title: subject.name,
                          unitsCount: subject.unitsCount,
                          lessonsCount: subject.lessonsCount,
                          progress: subject.progressPercent,
                          mastery: subject.masteryPercent,
                          isFavorite: subject.isFavorite,
                          onTap: () => context.push('/subjects/${subject.id}'),
                          onFavoriteTap: () =>
                              notifier.toggleFavorite(subject.id),
                        );
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
