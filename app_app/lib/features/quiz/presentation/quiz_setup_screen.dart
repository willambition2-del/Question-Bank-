import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../providers/quiz_provider.dart';

class QuizSetupScreen extends ConsumerStatefulWidget {
  final String? subjectId;
  final String? unitId;
  final String? lessonId;
  final String? examModelId;
  final String? scope;

  const QuizSetupScreen({
    super.key,
    this.subjectId,
    this.unitId,
    this.lessonId,
    this.examModelId,
    this.scope,
  });

  @override
  ConsumerState<QuizSetupScreen> createState() => _QuizSetupScreenState();
}

class _QuizSetupScreenState extends ConsumerState<QuizSetupScreen> {
  int _questionCount = 10;
  bool _isCustomCount = false;
  final _customCountController = TextEditingController(text: "15");

  String _questionType = "mixed"; // 'mixed', 'mcq', 'trueFalse'
  String _difficulty = "medium"; // 'easy', 'medium', 'hard', 'mixed'

  String _timerMode = "perQuestion"; // 'none', 'totalTime', 'perQuestion'
  final int _timerSeconds = 30;

  String _explanationMode = "afterEach"; // 'afterEach', 'atEnd', 'none'
  bool _useHearts = true;
  bool _excludeMastered = false;
  bool _unsolvedOnly = false;

  String? get _collectionScope {
    final value = widget.scope?.toLowerCase();
    if (value == null) return null;
    if (value.contains('mistakes')) return 'MISTAKES';
    if (value.contains('weakness')) return 'WEAKNESS';
    if (value.contains('saved')) return 'SAVED';
    if (value == 'random') return 'RANDOM';
    return null;
  }

  @override
  void dispose() {
    _customCountController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final quizState = ref.watch(quizNotifierProvider);
    final title = widget.examModelId != null
        ? "إعداد اختبار النموذج الوزاري"
        : widget.lessonId != null
        ? "إعداد اختبار الدرس"
        : widget.unitId != null
        ? "إعداد اختبار الوحدة"
        : "إعداد اختبار مخصص";

    return AppScaffold(
      appBar: AppBar(
        title: Text(title),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: AppSpacing.sm),

            // --- SUMMARY CARD ---
            AppCard(
              backgroundColor: AppColors.lightBlue,
              border: Border.all(
                color: AppColors.primaryBlue.withValues(alpha: 0.15),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "ملخص إعدادات الاختبار",
                    style: AppTypography.cardTitle.copyWith(
                      color: AppColors.primaryBlue,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    "• النطاق: ${widget.examModelId != null
                        ? 'نموذج وزاري'
                        : widget.lessonId != null
                        ? 'درس محدد'
                        : widget.unitId != null
                        ? 'وحدة دراسية'
                        : 'اختبار مادة'}",
                    style: AppTypography.body.copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppColors.darkText,
                    ),
                  ),
                  Text(
                    "• العدد: $_questionCount سؤالاً  |  الصعوبة: ${_getDifficultyLabel()}",
                    style: AppTypography.body.copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppColors.darkText,
                    ),
                  ),
                  Text(
                    "• التفسيرات: ${_getExplanationLabel()}  |  القلوب: ${_useHearts ? 'نشطة (3)' : 'معطلة'}",
                    style: AppTypography.body.copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppColors.darkText,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),

            // --- 1. QUESTIONS COUNT ---
            Text("عدد الأسئلة", style: AppTypography.sectionTitle),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                _buildCountChip(5),
                const SizedBox(width: 6),
                _buildCountChip(10),
                const SizedBox(width: 6),
                _buildCountChip(15),
                const SizedBox(width: 6),
                _buildCountChip(20),
                const SizedBox(width: 6),
                Expanded(
                  child: ChoiceChip(
                    label: const Text("مخصص"),
                    selected: _isCustomCount,
                    onSelected: (val) {
                      setState(() {
                        _isCustomCount = val;
                        if (val) {
                          _questionCount =
                              int.tryParse(_customCountController.text) ?? 15;
                        }
                      });
                    },
                    selectedColor: AppColors.primaryBlue,
                    backgroundColor: AppColors.surface,
                    labelStyle: TextStyle(
                      color: _isCustomCount ? Colors.white : AppColors.darkText,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            if (_isCustomCount) ...[
              const SizedBox(height: AppSpacing.xs),
              TextField(
                controller: _customCountController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: "أدخل عدد الأسئلة المطلوب",
                  border: OutlineInputBorder(),
                ),
                onChanged: (val) {
                  final parsed = int.tryParse(val);
                  if (parsed != null && parsed > 0) {
                    setState(() => _questionCount = parsed);
                  }
                },
              ),
            ],
            const SizedBox(height: AppSpacing.lg),

            // --- 2. DIFFICULTY ---
            Text("مستوى الصعوبة", style: AppTypography.sectionTitle),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                _buildDifficultyChip("سهل", "easy"),
                const SizedBox(width: 6),
                _buildDifficultyChip("متوسط", "medium"),
                const SizedBox(width: 6),
                _buildDifficultyChip("صعب", "hard"),
                const SizedBox(width: 6),
                _buildDifficultyChip("مختلط", "mixed"),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),

            // --- 3. QUESTION TYPES ---
            Text("نوع الأسئلة", style: AppTypography.sectionTitle),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                _buildTypeChip("اختيار من متعدد", "mcq"),
                const SizedBox(width: 6),
                _buildTypeChip("صح وخطأ", "trueFalse"),
                const SizedBox(width: 6),
                _buildTypeChip("مختلط", "mixed"),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),

            // --- 4. TIMER MODE ---
            Text("المؤقت الزمني", style: AppTypography.sectionTitle),
            const SizedBox(height: AppSpacing.sm),
            AppCard(
              child: RadioGroup<String>(
                groupValue: _timerMode,
                onChanged: (value) => setState(() => _timerMode = value!),
                child: Column(
                  children: [
                    RadioListTile<String>(
                      title: const Text("بدون مؤقت (مذاكرة هادئة)"),
                      value: "none",
                      fillColor: const WidgetStatePropertyAll(
                        AppColors.primaryBlue,
                      ),
                    ),
                    RadioListTile<String>(
                      title: const Text("وقت كلي لجميع الأسئلة"),
                      value: "totalTime",
                      fillColor: const WidgetStatePropertyAll(
                        AppColors.primaryBlue,
                      ),
                    ),
                    RadioListTile<String>(
                      title: const Text("وقت لكل سؤال (تحدي السرعة)"),
                      value: "perQuestion",
                      fillColor: const WidgetStatePropertyAll(
                        AppColors.primaryBlue,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),

            // --- 5. EXPLANATIONS & HEARTS OPTIONS ---
            Text(
              "التفسيرات وإعدادات المحاولة",
              style: AppTypography.sectionTitle,
            ),
            const SizedBox(height: AppSpacing.sm),
            AppCard(
              child: Column(
                children: [
                  ListTile(
                    title: const Text("عرض الشرح والتفسير"),
                    trailing: DropdownButton<String>(
                      value: _explanationMode,
                      items: const [
                        DropdownMenuItem(
                          value: "afterEach",
                          child: Text("بعد كل سؤال"),
                        ),
                        DropdownMenuItem(
                          value: "atEnd",
                          child: Text("في نهاية الاختبار"),
                        ),
                        DropdownMenuItem(
                          value: "none",
                          child: Text("بدون شرح"),
                        ),
                      ],
                      onChanged: (val) {
                        if (val != null) setState(() => _explanationMode = val);
                      },
                    ),
                  ),
                  const Divider(),
                  SwitchListTile(
                    title: const Text("نظام القلوب (3 أخطاء تنهي الاختبار)"),
                    value: _useHearts,
                    thumbColor: const WidgetStatePropertyAll(
                      AppColors.primaryBlue,
                    ),
                    onChanged: (val) => setState(() => _useHearts = val),
                  ),
                  const Divider(),
                  SwitchListTile(
                    title: const Text("استبعاد الأسئلة المتقنة سابقاً"),
                    value: _excludeMastered,
                    thumbColor: const WidgetStatePropertyAll(
                      AppColors.primaryBlue,
                    ),
                    onChanged: (val) => setState(() => _excludeMastered = val),
                  ),
                  const Divider(),
                  SwitchListTile(
                    title: const Text("الأسئلة التي لم تُحل فقط"),
                    value: _unsolvedOnly,
                    thumbColor: const WidgetStatePropertyAll(
                      AppColors.primaryBlue,
                    ),
                    onChanged: (val) => setState(() => _unsolvedOnly = val),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xl),

            // --- START BUTTON ---
            PrimaryButton(
              width: double.infinity,
              text: "ابدأ الاختبار الآن 🚀",
              isLoading: quizState.status == QuizQuestionStatus.loading,
              onPressed: () async {
                final useTimer = _timerMode != "none";
                final started = await ref
                    .read(quizNotifierProvider.notifier)
                    .startQuiz(
                      subjectId: widget.subjectId,
                      unitId: widget.unitId,
                      lessonId: widget.lessonId,
                      examModelId: widget.examModelId,
                      scope: _collectionScope,
                      count: _questionCount,
                      difficulty: _difficulty,
                      type: _questionType,
                      useHearts: _useHearts,
                      useTimer: useTimer,
                      timerLimitSeconds: _timerSeconds,
                      timingMode: _timerMode,
                      explanationMode: _explanationMode,
                      excludeMastered: _excludeMastered,
                      unansweredOnly: _unsolvedOnly,
                    );
                if (!context.mounted) return;
                final current = ref.read(quizNotifierProvider);
                if (started) {
                  if (current.warningMessage != null) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(current.warningMessage!)),
                    );
                  }
                  context.push('/quiz');
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        current.errorMessage ?? 'تعذر بدء الاختبار.',
                      ),
                    ),
                  );
                }
              },
            ),
            const SizedBox(height: AppSpacing.xxl),
          ],
        ),
      ),
    );
  }

  Widget _buildCountChip(int count) {
    final isActive = !_isCustomCount && _questionCount == count;
    return ChoiceChip(
      label: Text("$count"),
      selected: isActive,
      onSelected: (val) {
        setState(() {
          _isCustomCount = false;
          _questionCount = count;
        });
      },
      selectedColor: AppColors.primaryBlue,
      backgroundColor: AppColors.surface,
      labelStyle: TextStyle(
        color: isActive ? Colors.white : AppColors.darkText,
        fontWeight: FontWeight.bold,
      ),
    );
  }

  Widget _buildDifficultyChip(String text, String value) {
    final isActive = _difficulty == value;
    return Expanded(
      child: ChoiceChip(
        label: Text(text),
        selected: isActive,
        onSelected: (val) => setState(() => _difficulty = value),
        selectedColor: AppColors.primaryBlue,
        backgroundColor: AppColors.surface,
        labelStyle: TextStyle(
          color: isActive ? Colors.white : AppColors.darkText,
          fontWeight: FontWeight.bold,
          fontSize: 11,
        ),
      ),
    );
  }

  Widget _buildTypeChip(String text, String value) {
    final isActive = _questionType == value;
    return Expanded(
      child: ChoiceChip(
        label: Text(text),
        selected: isActive,
        onSelected: (val) => setState(() => _questionType = value),
        selectedColor: AppColors.primaryBlue,
        backgroundColor: AppColors.surface,
        labelStyle: TextStyle(
          color: isActive ? Colors.white : AppColors.darkText,
          fontWeight: FontWeight.bold,
          fontSize: 11,
        ),
      ),
    );
  }

  String _getDifficultyLabel() {
    switch (_difficulty) {
      case 'easy':
        return "سهل";
      case 'medium':
        return "متوسط";
      case 'hard':
        return "صعب";
      case 'mixed':
      default:
        return "مختلط";
    }
  }

  String _getExplanationLabel() {
    switch (_explanationMode) {
      case 'afterEach':
        return "بعد كل سؤال";
      case 'atEnd':
        return "في النهاية";
      case 'none':
      default:
        return "بدون";
    }
  }
}
