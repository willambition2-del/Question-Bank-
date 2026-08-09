import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/design_tokens.dart';
import '../../../core/network/analytics_api_models.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_card.dart';
import '../providers/statistics_dashboard_provider.dart';

class StatisticsScreen extends ConsumerStatefulWidget {
  const StatisticsScreen({super.key});

  @override
  ConsumerState<StatisticsScreen> createState() => _StatisticsScreenState();
}

class _StatisticsScreenState extends ConsumerState<StatisticsScreen> {
  @override
  Widget build(BuildContext context) {
    final state = ref.watch(statisticsDashboardProvider);
    final overview = state.overview.value;
    final trend = state.trend.value;
    final heatmap = state.heatmap.value;
    final subjects = state.subjects.value;
    final questions = state.questions.value;
    final recommendations = state.recommendations.value;

    return RefreshIndicator(
      onRefresh: ref.read(statisticsDashboardProvider.notifier).load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: AppSpacing.sm),
            Text(
              'الإحصائيات والتحليلات الشاملة',
              style: AppTypography.pageTitle,
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'تقييم تحليلي لأدائك الأكاديمي ونقاط القوة والدروس المستهدفة',
              style: AppTypography.body,
            ),
            const SizedBox(height: AppSpacing.md),
            _RangeSelector(
              value: state.range,
              onChanged: (value) => ref
                  .read(statisticsDashboardProvider.notifier)
                  .setRange(value),
              onCustom: _pickCustomRange,
            ),
            const SizedBox(height: AppSpacing.md),
            if (state.overview.hasError)
              _ErrorCard(
                message: 'تعذر تحميل ملخص الإحصائيات.',
                onRetry: ref.read(statisticsDashboardProvider.notifier).load,
              ),
            GridView.count(
              crossAxisCount: 3,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: AppSpacing.xs,
              mainAxisSpacing: AppSpacing.xs,
              childAspectRatio: 1.1,
              children: [
                _SummaryCard(
                  'المحاولات',
                  _value(overview?.completedQuizzes),
                  Icons.assignment_outlined,
                  AppColors.primaryBlue,
                ),
                _SummaryCard(
                  'متوسط الدقة',
                  overview == null
                      ? '—'
                      : '${overview.accuracyPercent.toStringAsFixed(0)}%',
                  Icons.insights,
                  AppColors.successGreen,
                ),
                _SummaryCard(
                  'وقت الدراسة',
                  overview == null ? '—' : _hours(overview.studyTimeSeconds),
                  Icons.timer_outlined,
                  AppColors.goldAccent,
                ),
                _SummaryCard(
                  'السلسلة',
                  overview == null ? '—' : '${overview.currentStreakDays} أيام',
                  Icons.local_fire_department,
                  AppColors.warmOrange,
                ),
                _SummaryCard(
                  'الأسئلة المجابة',
                  _value(overview?.totalAnswered),
                  Icons.fact_check_outlined,
                  AppColors.info,
                ),
                _SummaryCard(
                  'نسبة الإتقان',
                  overview == null
                      ? '—'
                      : '${overview.masteryPercent.toStringAsFixed(0)}%',
                  Icons.verified_rounded,
                  AppColors.successGreen,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'الإجابات الصحيحة والخاطئة',
              style: AppTypography.sectionTitle,
            ),
            const SizedBox(height: AppSpacing.xs),
            AppCard(
              child: overview == null || overview.totalAnswered == 0
                  ? const SizedBox(
                      height: 120,
                      child: Center(
                        child: Text('لا توجد إجابات في هذه الفترة'),
                      ),
                    )
                  : SizedBox(
                      height: 160,
                      child: Row(
                        children: [
                          Expanded(
                            child: PieChart(
                              PieChartData(
                                sectionsSpace: 4,
                                centerSpaceRadius: 36,
                                sections: [
                                  PieChartSectionData(
                                    color: AppColors.successGreen,
                                    value: overview.totalCorrect.toDouble(),
                                    title: '${overview.totalCorrect}',
                                    radius: 30,
                                  ),
                                  PieChartSectionData(
                                    color: AppColors.errorCoral,
                                    value: overview.totalWrong.toDouble(),
                                    title: '${overview.totalWrong}',
                                    radius: 30,
                                  ),
                                ],
                              ),
                            ),
                          ),
                          Expanded(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _Legend(
                                  AppColors.successGreen,
                                  'صحيحة: ${overview.totalCorrect}',
                                ),
                                const SizedBox(height: 8),
                                _Legend(
                                  AppColors.errorCoral,
                                  'خاطئة: ${overview.totalWrong}',
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'الإجمالي: ${overview.totalAnswered}',
                                  style: AppTypography.caption,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text('تطور الدقة عبر الأيام', style: AppTypography.sectionTitle),
            const SizedBox(height: AppSpacing.xs),
            AppCard(
              child: SizedBox(
                height: 170,
                child: trend == null
                    ? const Center(child: CircularProgressIndicator())
                    : trend.isEmpty
                    ? const Center(child: Text('لا يوجد خط زمني لهذه الفترة'))
                    : LineChart(
                        LineChartData(
                          minY: 0,
                          maxY: 100,
                          minX: 0,
                          maxX: (trend.length - 1).toDouble(),
                          borderData: FlBorderData(show: false),
                          gridData: const FlGridData(
                            show: true,
                            drawVerticalLine: false,
                          ),
                          titlesData: const FlTitlesData(
                            topTitles: AxisTitles(
                              sideTitles: SideTitles(showTitles: false),
                            ),
                            rightTitles: AxisTitles(
                              sideTitles: SideTitles(showTitles: false),
                            ),
                            bottomTitles: AxisTitles(
                              sideTitles: SideTitles(showTitles: false),
                            ),
                          ),
                          lineBarsData: [
                            LineChartBarData(
                              spots: [
                                for (var i = 0; i < trend.length; i++)
                                  FlSpot(
                                    i.toDouble(),
                                    trend[i].accuracyPercent,
                                  ),
                              ],
                              isCurved: true,
                              color: AppColors.primaryBlue,
                              barWidth: 3,
                              belowBarData: BarAreaData(
                                show: true,
                                color: AppColors.primaryBlue.withValues(
                                  alpha: 0.1,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text('النشاط اليومي', style: AppTypography.sectionTitle),
            const SizedBox(height: AppSpacing.xs),
            AppCard(
              child: heatmap == null
                  ? const Center(child: CircularProgressIndicator())
                  : heatmap.isEmpty
                  ? const Center(child: Text('لا يوجد نشاط في هذه الفترة'))
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        for (final point in heatmap.take(7))
                          _HeatCell(point: point),
                      ],
                    ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text('الأداء حسب المادة', style: AppTypography.sectionTitle),
            const SizedBox(height: AppSpacing.xs),
            AppCard(
              child: subjects == null
                  ? const Center(child: CircularProgressIndicator())
                  : subjects.isEmpty
                  ? const Center(child: Text('لا توجد بيانات مواد بعد'))
                  : Column(
                      children: [
                        for (final subject in subjects) ...[
                          _ProgressRow(metric: subject),
                          if (subject != subjects.last) const Divider(),
                        ],
                      ],
                    ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'توزيع الصعوبة وزمن الإجابة',
              style: AppTypography.sectionTitle,
            ),
            const SizedBox(height: AppSpacing.xs),
            AppCard(
              child: questions == null
                  ? const Center(child: CircularProgressIndicator())
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_difficultyText(questions.difficultyDistribution)),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          'متوسط الإجابة: ${(questions.averageAnswerTimeMs / 1000).toStringAsFixed(1)} ثانية',
                        ),
                      ],
                    ),
            ),
            const SizedBox(height: AppSpacing.lg),
            AppCard(
              backgroundColor: AppColors.lightBlue,
              border: Border.all(
                color: AppColors.primaryBlue.withValues(alpha: 0.2),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'التوصيات المخصصة لك',
                    style: AppTypography.cardTitle.copyWith(
                      color: AppColors.primaryBlue,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  if (recommendations == null)
                    const LinearProgressIndicator()
                  else if (recommendations.lessons.isEmpty &&
                      recommendations.weaknesses.isEmpty)
                    const Text('لا توجد توصيات جديدة حاليًا.')
                  else
                    Text(
                      recommendations.lessons.firstOrNull?.reason ??
                          recommendations.weaknesses.first.reason,
                      style: AppTypography.body,
                    ),
                  const SizedBox(height: AppSpacing.md),
                  PrimaryButton(
                    width: double.infinity,
                    text: 'ابدأ اختبار نقاط الضعف الآن 🎯',
                    onPressed: recommendations == null
                        ? null
                        : () => context.push('/quiz/setup?scope=weakness'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xxl),
          ],
        ),
      ),
    );
  }

  Future<void> _pickCustomRange() async {
    final now = DateTime.now();
    final selected = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 5),
      lastDate: now,
    );
    if (selected == null || !mounted) return;
    await ref
        .read(statisticsDashboardProvider.notifier)
        .setCustomRange(selected.start, selected.end);
  }
}

class _RangeSelector extends StatelessWidget {
  final String value;
  final ValueChanged<String> onChanged;
  final VoidCallback onCustom;
  const _RangeSelector({
    required this.value,
    required this.onChanged,
    required this.onCustom,
  });

  @override
  Widget build(BuildContext context) => Row(
    children: [
      for (final entry in const {
        'week': 'الأسبوع',
        'month': 'الشهر',
        'all': 'كل الوقت',
      }.entries)
        Expanded(
          child: ChoiceChip(
            label: Text(entry.value),
            selected: value == entry.key,
            onSelected: (_) => onChanged(entry.key),
          ),
        ),
      IconButton(onPressed: onCustom, icon: const Icon(Icons.date_range)),
    ],
  );
}

class _SummaryCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  const _SummaryCard(this.label, this.value, this.icon, this.color);

  @override
  Widget build(BuildContext context) => AppCard(
    padding: const EdgeInsets.all(AppSpacing.xs),
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(icon, color: color, size: 18),
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.caption,
        ),
        Text(
          value,
          style: AppTypography.caption.copyWith(fontWeight: FontWeight.bold),
        ),
      ],
    ),
  );
}

class _Legend extends StatelessWidget {
  final Color color;
  final String text;
  const _Legend(this.color, this.text);
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      ),
      const SizedBox(width: 6),
      Text(text, style: AppTypography.caption),
    ],
  );
}

class _HeatCell extends StatelessWidget {
  final HeatmapPoint point;
  const _HeatCell({required this.point});
  @override
  Widget build(BuildContext context) => Column(
    children: [
      Container(
        width: 28,
        height: 28,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Color.lerp(
            AppColors.border,
            AppColors.primaryBlue,
            point.activityLevel / 4,
          ),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          '${point.answeredCount}',
          style: const TextStyle(fontSize: 10),
        ),
      ),
      Text(
        '${point.date.day}/${point.date.month}',
        style: AppTypography.caption.copyWith(fontSize: 8),
      ),
    ],
  );
}

class _ProgressRow extends StatelessWidget {
  final ProgressMetric metric;
  const _ProgressRow({required this.metric});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(metric.name),
            Text('${metric.mastery.toStringAsFixed(0)}%'),
          ],
        ),
        const SizedBox(height: 4),
        LinearProgressIndicator(value: (metric.mastery / 100).clamp(0, 1)),
      ],
    ),
  );
}

class _ErrorCard extends StatelessWidget {
  final String message;
  final Future<void> Function() onRetry;
  const _ErrorCard({required this.message, required this.onRetry});
  @override
  Widget build(BuildContext context) => AppCard(
    backgroundColor: AppColors.lightError,
    child: Row(
      children: [
        Expanded(child: Text(message)),
        TextButton(onPressed: onRetry, child: const Text('إعادة المحاولة')),
      ],
    ),
  );
}

String _value(int? value) => value?.toString() ?? '—';
String _hours(int seconds) => '${(seconds / 3600).toStringAsFixed(1)} ساعة';
String _difficultyText(Map<String, int> values) {
  if (values.isEmpty) return 'لا توجد بيانات صعوبة';
  final total = values.values.fold<int>(0, (sum, value) => sum + value);
  if (total == 0) return 'لا توجد بيانات صعوبة';
  return values.entries
      .map((entry) => '${entry.key}: ${((entry.value / total) * 100).round()}%')
      .join(' • ');
}
