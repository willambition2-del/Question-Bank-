import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/models/subject_model.dart';
import '../../../core/models/unit_model.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../providers/subject_details_provider.dart';

class SubjectDetailsScreen extends ConsumerStatefulWidget {
  final String subjectId;

  const SubjectDetailsScreen({super.key, required this.subjectId});

  @override
  ConsumerState<SubjectDetailsScreen> createState() =>
      _SubjectDetailsScreenState();
}

class _SubjectDetailsScreenState extends ConsumerState<SubjectDetailsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String _unitFilter =
      "all"; // 'all', 'completed', 'inProgress', 'notStarted', 'weak'

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final subjectAsync = ref.watch(subjectDetailsProvider(widget.subjectId));
    final unitsAsync = ref.watch(subjectUnitsProvider(widget.subjectId));

    return AppScaffold(
      appBar: AppBar(
        title: subjectAsync.when(
          data: (sub) => Text(sub?.name ?? "تفاصيل المادة"),
          loading: () => const Text("جاري التحميل..."),
          error: (_, __) => const Text("خطأ"),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: subjectAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.primaryBlue),
        ),
        error: (err, _) => Center(child: Text("حدث خطأ: $err")),
        data: (subject) {
          if (subject == null) {
            return const Center(child: Text("المادة غير موجودة"));
          }
          Color subjectColor = AppColors.primaryBlue;
          try {
            var hex = subject.colorHex.trim().toUpperCase().replaceAll('#', '').replaceAll('0X', '');
            if (hex.length == 6) hex = 'FF$hex';
            subjectColor = Color(int.parse(hex, radix: 16));
          } catch (e) {
            debugPrint('Invalid subject color: ${subject.colorHex}');
          }

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // --- SUBJECT STATS CARD ---
              AppCard(
                child: Column(
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(AppSpacing.sm),
                          decoration: BoxDecoration(
                            color: subjectColor.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(AppRadius.md),
                          ),
                          child: Icon(
                            _getSubjectIcon(subject.icon),
                            color: subjectColor,
                            size: 30,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                "تحليل الأداء في مادة ${subject.name}",
                                style: AppTypography.cardTitle.copyWith(
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                "الأسئلة المجابة: ${subject.correctAnswers + subject.wrongAnswers} سؤال",
                                style: AppTypography.caption,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),

                    // Progress Row
                    Row(
                      children: [
                        _buildSummaryCol(
                          "إتقان المادة",
                          "${(subject.masteryPercent * 100).toInt()}%",
                          AppColors.successGreen,
                        ),
                        _buildVerticalDivider(),
                        _buildSummaryCol(
                          "الإجابات الصحيحة",
                          "${subject.correctAnswers}",
                          AppColors.primaryBlue,
                        ),
                        _buildVerticalDivider(),
                        _buildSummaryCol(
                          "الإجابات الخاطئة",
                          "${subject.wrongAnswers}",
                          AppColors.errorCoral,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),

              // --- QUICK EXAM ACTIONS ---
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                child: Row(
                  children: [
                    _buildQuickActionBtn(
                      text: "اختبار شامل",
                      icon: Icons.assignment,
                      color: AppColors.primaryBlue,
                      onTap: () => context.push(
                        '/quiz/setup?subjectId=${subject.id}&scope=subject',
                      ),
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    _buildQuickActionBtn(
                      text: "اختبار عشوائي",
                      icon: Icons.shuffle,
                      color: AppColors.goldAccent,
                      onTap: () => context.push(
                        '/quiz/setup?subjectId=${subject.id}&scope=random',
                      ),
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    _buildQuickActionBtn(
                      text: "أخطائي بالمادة",
                      icon: Icons.error_outline,
                      color: AppColors.errorCoral,
                      onTap: () => context.push(
                        '/quiz/setup?subjectId=${subject.id}&scope=mistakes',
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),

              // --- TAB BAR ---
              TabBar(
                controller: _tabController,
                indicatorColor: AppColors.primaryBlue,
                labelColor: AppColors.primaryBlue,
                unselectedLabelColor: AppColors.secondaryText,
                labelStyle: AppTypography.cardTitle.copyWith(
                  fontWeight: FontWeight.bold,
                ),
                unselectedLabelStyle: AppTypography.cardTitle,
                tabs: const [
                  Tab(text: "الوحدات"),
                  Tab(text: "النماذج الوزارية"),
                  Tab(text: "الإحصائيات"),
                ],
              ),
              const SizedBox(height: AppSpacing.md),

              // --- TAB VIEWS ---
              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    // View 1: Units list with filters
                    Column(
                      children: [
                        // Unit Filters
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          physics: const BouncingScrollPhysics(),
                          child: Row(
                            children: [
                              _buildUnitFilterChip("الكل", "all"),
                              const SizedBox(width: AppSpacing.xs),
                              _buildUnitFilterChip("قيد الدراسة", "inProgress"),
                              const SizedBox(width: AppSpacing.xs),
                              _buildUnitFilterChip("مكتملة", "completed"),
                              const SizedBox(width: AppSpacing.xs),
                              _buildUnitFilterChip("لم تبدأ", "notStarted"),
                            ],
                          ),
                        ),
                        const SizedBox(height: AppSpacing.md),

                        // List of Units
                        Expanded(
                          child: unitsAsync.when(
                            loading: () => const Center(
                              child: CircularProgressIndicator(
                                color: AppColors.primaryBlue,
                              ),
                            ),
                            error: (err, _) => Center(child: Text("خطأ: $err")),
                            data: (units) {
                              final filtered = _filterUnits(units);
                              if (filtered.isEmpty) {
                                return const Center(
                                  child: Text("لا توجد وحدات مطابقة للفلاتر"),
                                );
                              }
                              return ListView.builder(
                                itemCount: filtered.length,
                                physics: const BouncingScrollPhysics(),
                                itemBuilder: (context, index) {
                                  final unit = filtered[index];
                                  return _buildUnitItem(
                                    context,
                                    unit,
                                    subjectColor,
                                  );
                                },
                              );
                            },
                          ),
                        ),
                      ],
                    ),

                    // View 2: Ministerial Exams related to this subject
                    _buildExamsTab(context, subject),

                    // View 3: Subject level stats details
                    _buildSubjectStatsTab(subject),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildSummaryCol(String label, String value, Color valueColor) {
    return Expanded(
      child: Column(
        children: [
          Text(label, style: AppTypography.caption),
          const SizedBox(height: 2),
          Text(
            value,
            style: AppTypography.cardTitle.copyWith(
              fontWeight: FontWeight.bold,
              color: valueColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVerticalDivider() {
    return Container(height: 24, width: 1, color: AppColors.border);
  }

  Widget _buildQuickActionBtn({
    required String text,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(width: AppSpacing.xs),
          Text(
            text,
            style: AppTypography.caption.copyWith(
              fontWeight: FontWeight.bold,
              color: AppColors.darkText,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUnitFilterChip(String text, String value) {
    final isActive = _unitFilter == value;
    return ChoiceChip(
      label: Text(
        text,
        style: AppTypography.caption.copyWith(
          color: isActive ? Colors.white : AppColors.secondaryText,
          fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
        ),
      ),
      selected: isActive,
      onSelected: (selected) {
        if (selected) {
          setState(() {
            _unitFilter = value;
          });
        }
      },
      selectedColor: AppColors.primaryBlue,
      backgroundColor: AppColors.cardBackground,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.pill),
        side: BorderSide(
          color: isActive ? Colors.transparent : AppColors.border,
        ),
      ),
    );
  }

  List<UnitModel> _filterUnits(List<UnitModel> units) {
    if (_unitFilter == "all") return units;
    return units.where((u) => u.status == _unitFilter).toList();
  }

  Widget _buildUnitItem(BuildContext context, UnitModel unit, Color color) {
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      onTap: () {
        context.push('/subjects/${widget.subjectId}/units/${unit.id}');
      },
      child: Row(
        children: [
          // Circular progress tracker
          Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 48,
                height: 48,
                child: CircularProgressIndicator(
                  value: unit.progressPercent,
                  strokeWidth: 5,
                  backgroundColor: AppColors.border,
                  valueColor: AlwaysStoppedAnimation<Color>(color),
                ),
              ),
              Text(
                "${(unit.progressPercent * 100).toInt()}%",
                style: AppTypography.caption.copyWith(
                  fontWeight: FontWeight.bold,
                  fontSize: 10,
                  color: AppColors.darkText,
                ),
              ),
            ],
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  unit.name,
                  style: AppTypography.cardTitle.copyWith(
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  "${unit.lessonsCount} دروس  •  ${unit.questionsCount} سؤال",
                  style: AppTypography.caption,
                ),
              ],
            ),
          ),
          const Icon(
            Icons.arrow_forward_ios,
            size: 16,
            color: AppColors.border,
          ),
        ],
      ),
    );
  }

  Widget _buildExamsTab(BuildContext context, SubjectModel subject) {
    // Show exams related to this subject
    return Consumer(
      builder: (context, ref, child) {
        final examsAsync = ref.watch(
          examModelsListProvider((
            subjectId: subject.id,
            year: null,
            sourceId: null,
          )),
        );

        return examsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, _) => Center(child: Text("خطأ: $err")),
          data: (exams) {
            final filteredExams = exams
                .where((e) => e.subjectId == subject.id)
                .toList();
            if (filteredExams.isEmpty) {
              return const Center(
                child: Text("لا توجد نماذج وزارية مضافة لهذه المادة حالياً."),
              );
            }
            return ListView.builder(
              itemCount: filteredExams.length,
              itemBuilder: (context, index) {
                final exam = filteredExams[index];
                return AppCard(
                  margin: const EdgeInsets.only(bottom: AppSpacing.md),
                  onTap: () {
                    context.push('/quiz/setup?examModelId=${exam.id}');
                  },
                  child: Row(
                    children: [
                      const Icon(
                        Icons.assignment,
                        color: AppColors.primaryBlue,
                        size: 30,
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              exam.title,
                              style: AppTypography.cardTitle.copyWith(
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              "سنة ${exam.year}  •  ${exam.questionsCount} سؤال  •  ${exam.durationMinutes} دقيقة",
                              style: AppTypography.caption,
                            ),
                          ],
                        ),
                      ),
                      if (exam.bestScore != null) ...[
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text("أفضل نتيجة", style: AppTypography.caption),
                            Text(
                              "${exam.bestScore}%",
                              style: AppTypography.cardTitle.copyWith(
                                color: AppColors.successGreen,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ] else ...[
                        const Icon(
                          Icons.arrow_forward_ios,
                          size: 14,
                          color: AppColors.border,
                        ),
                      ],
                    ],
                  ),
                );
              },
            );
          },
        );
      },
    );
  }

  Widget _buildSubjectStatsTab(SubjectModel subject) {
    return ListView(
      children: [
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "تفصيل إحصائيات المذاكرة",
                style: AppTypography.sectionTitle,
              ),
              const SizedBox(height: AppSpacing.md),
              _buildStatsDetailRow(
                "إجمالي الإجابات الصحيحة",
                "${subject.correctAnswers} إجابة",
                AppColors.successGreen,
              ),
              const Divider(height: AppSpacing.md),
              _buildStatsDetailRow(
                "إجمالي الإجابات الخاطئة",
                "${subject.wrongAnswers} إجابة",
                AppColors.errorCoral,
              ),
              const Divider(height: AppSpacing.md),
              _buildStatsDetailRow(
                "نسبة الحلول الصحيحة للكل",
                "${(subject.masteryPercent * 100).toInt()}%",
                AppColors.primaryBlue,
              ),
              const Divider(height: AppSpacing.md),
              _buildStatsDetailRow(
                "الأسئلة المتبقية لحل المادة",
                "${subject.questionsCount - (subject.correctAnswers + subject.wrongAnswers)} سؤال",
                AppColors.secondaryText,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStatsDetailRow(String label, String value, Color color) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: AppTypography.body),
        Text(
          value,
          style: AppTypography.cardTitle.copyWith(
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
      ],
    );
  }

  IconData _getSubjectIcon(String iconName) {
    switch (iconName) {
      case "book_outlined":
        return Icons.import_contacts;
      case "biotech":
        return Icons.biotech;
      case "translate":
        return Icons.translate;
      case "science":
        return Icons.science;
      case "architecture":
        return Icons.architecture;
      case "menu_book":
        return Icons.menu_book;
      case "star":
        return Icons.star;
      default:
        return Icons.import_contacts;
    }
  }
}
