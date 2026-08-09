import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../app/theme/design_tokens.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../domain/assistant_models.dart';
import '../providers/assistant_provider.dart';

class AssistantScreen extends ConsumerStatefulWidget {
  final String? lessonId;
  final String? questionId;
  final String? attemptId;
  final String? initialAction;

  const AssistantScreen({
    super.key,
    this.lessonId,
    this.questionId,
    this.attemptId,
    this.initialAction,
  });

  @override
  ConsumerState<AssistantScreen> createState() => _AssistantScreenState();
}

class _AssistantScreenState extends ConsumerState<AssistantScreen> {
  final _messageController = TextEditingController();
  bool _initialActionSent = false;
  Uint8List? _selectedImage;
  String? _selectedImageName;
  ImageAnalysisMode _imageMode = ImageAnalysisMode.explain;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialActionSent) return;
    _initialActionSent = true;
    Future.microtask(_runInitialAction);
  }

  Future<void> _runInitialAction() async {
    final notifier = ref.read(assistantProvider.notifier);
    if (widget.lessonId != null && widget.initialAction == 'summarize') {
      await notifier.summarizeLesson(widget.lessonId!);
    } else if (widget.lessonId != null && widget.initialAction == 'simplify') {
      await notifier.simplifyLesson(widget.lessonId!);
    } else if (widget.questionId != null &&
        widget.attemptId != null &&
        widget.initialAction == 'hint') {
      await notifier.questionHint(widget.questionId!, widget.attemptId!);
    } else if (widget.questionId != null &&
        widget.attemptId != null &&
        widget.initialAction == 'explain') {
      await notifier.explainQuestion(widget.questionId!, widget.attemptId!);
    }
  }

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(assistantProvider);
    final busy =
        state.status == AssistantUiStatus.processing ||
        state.status == AssistantUiStatus.uploading ||
        state.status == AssistantUiStatus.streaming;
    return AppScaffold(
      appBar: AppBar(
        title: const Text('المساعد الدراسي'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.only(bottom: AppSpacing.md),
              child: _body(state, busy),
            ),
          ),
          _imageTools(busy, state),
          _composer(busy),
        ],
      ),
    );
  }

  Widget _body(AssistantState state, bool busy) {
    if (state.imageResponse != null) {
      return _imageResult(state.imageResponse!);
    }
    if (busy) {
      return const Padding(
        padding: EdgeInsets.only(top: 72),
        child: Column(
          children: [
            CircularProgressIndicator(),
            SizedBox(height: AppSpacing.md),
            Text('أراجع المعلومات المتاحة…'),
          ],
        ),
      );
    }
    if (state.status == AssistantUiStatus.idle) {
      return const AppCard(
        child: Row(
          children: [
            Icon(Icons.auto_awesome_rounded, color: AppColors.primaryBlue),
            SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                'اسأل سؤالًا دراسيًا، أو استخدم أدوات التلخيص والتبسيط من صفحة الدرس.',
              ),
            ),
          ],
        ),
      );
    }
    if (state.status == AssistantUiStatus.limitReached ||
        state.status == AssistantUiStatus.temporarilyUnavailable ||
        state.status == AssistantUiStatus.retry) {
      return _errorCard(state.errorMessage ?? 'تعذر إكمال الطلب.');
    }
    final response = state.response;
    if (response == null) return _errorCard('لم تصل استجابة قابلة للعرض.');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!response.hasSufficientContext)
          const AppCard(
            backgroundColor: AppColors.lightGold,
            child: Text('لا تتوفر مراجع كافية وموثوقة للإجابة عن هذا السؤال.'),
          ),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(response.summary, style: AppTypography.body),
              if (response.steps.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.md),
                ...response.steps.indexed.map(
                  (entry) => Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                    child: Text('${entry.$1 + 1}. ${entry.$2}'),
                  ),
                ),
              ],
              if (response.keyConcept != null)
                _labelValue('الفكرة الأساسية', response.keyConcept!),
              if (response.commonMistake != null)
                _labelValue('خطأ شائع', response.commonMistake!),
            ],
          ),
        ),
        if (response.sources.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Text('المراجع', style: AppTypography.sectionTitle),
          const SizedBox(height: AppSpacing.xs),
          ...response.sources.map(_sourceCard),
        ],
        if (response.remainingToday != null)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Text(
              'المتبقي اليوم: ${response.remainingToday}',
              style: AppTypography.caption,
              textAlign: TextAlign.center,
            ),
          ),
      ],
    );
  }

  Widget _imageTools(bool busy, AssistantState state) => Padding(
    padding: const EdgeInsets.only(bottom: AppSpacing.xs),
    child: Column(
      children: [
        if (_selectedImage != null)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.xs),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.memory(
                _selectedImage!,
                height: 120,
                width: double.infinity,
                fit: BoxFit.cover,
              ),
            ),
          ),
        if (state.status == AssistantUiStatus.uploading)
          LinearProgressIndicator(value: state.uploadProgress),
        Row(
          children: [
            IconButton.outlined(
              tooltip: 'التقاط صورة',
              onPressed: busy ? null : () => _pickImage(ImageSource.camera),
              icon: const Icon(Icons.photo_camera_outlined),
            ),
            const SizedBox(width: AppSpacing.xs),
            IconButton.outlined(
              tooltip: 'اختيار من المعرض',
              onPressed: busy ? null : () => _pickImage(ImageSource.gallery),
              icon: const Icon(Icons.photo_library_outlined),
            ),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: DropdownButtonFormField<ImageAnalysisMode>(
                initialValue: _imageMode,
                decoration: const InputDecoration(
                  labelText: 'نوع التحليل',
                  isDense: true,
                ),
                items: const [
                  DropdownMenuItem(
                    value: ImageAnalysisMode.extractOnly,
                    child: Text('استخراج فقط'),
                  ),
                  DropdownMenuItem(
                    value: ImageAnalysisMode.explain,
                    child: Text('شرح'),
                  ),
                  DropdownMenuItem(
                    value: ImageAnalysisMode.solve,
                    child: Text('حل'),
                  ),
                  DropdownMenuItem(
                    value: ImageAnalysisMode.checkMyAnswer,
                    child: Text('تحقق من إجابتي'),
                  ),
                ],
                onChanged: busy
                    ? null
                    : (value) => setState(() {
                        if (value != null) _imageMode = value;
                      }),
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            FilledButton(
              onPressed: busy || _selectedImage == null ? null : _analyzeImage,
              child: const Text('تحليل'),
            ),
          ],
        ),
      ],
    ),
  );

  Future<void> _pickImage(ImageSource source) async {
    final image = await ImagePicker().pickImage(
      source: source,
      imageQuality: 95,
      maxWidth: 4096,
      maxHeight: 4096,
    );
    if (image == null || !mounted) return;
    final bytes = await image.readAsBytes();
    if (!mounted) return;
    setState(() {
      _selectedImage = bytes;
      _selectedImageName = image.name;
    });
  }

  Future<void> _analyzeImage() async {
    final bytes = _selectedImage;
    if (bytes == null) return;
    await ref
        .read(assistantProvider.notifier)
        .analyzeImage(
          bytes: bytes,
          fileName: _selectedImageName ?? 'question.jpg',
          mode: _imageMode,
          userQuestion: _messageController.text.trim(),
        );
  }

  Widget _imageResult(ImageQuestionAnalysisResponse response) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(response.normalizedQuestion, style: AppTypography.cardTitle),
            if (response.detectedOptions.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              ...response.detectedOptions.map((option) => Text('• $option')),
            ],
            if (response.explanation != null)
              _labelValue('الشرح', response.explanation!),
            if (response.solutionSteps.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.md),
              ...response.solutionSteps.indexed.map(
                (entry) => Text('${entry.$1 + 1}. ${entry.$2}'),
              ),
            ],
            if (response.finalAnswer != null)
              _labelValue('الإجابة النهائية', response.finalAnswer!),
            if (response.requiresClarification)
              const Padding(
                padding: EdgeInsets.only(top: AppSpacing.sm),
                child: Text('الصورة تحتاج إلى توضيح إضافي.'),
              ),
          ],
        ),
      ),
      if (response.warnings.isNotEmpty)
        AppCard(child: Text(response.warnings.join('\n'))),
    ],
  );
  Widget _composer(bool busy) => SafeArea(
    top: false,
    child: Row(
      children: [
        Expanded(
          child: TextField(
            controller: _messageController,
            enabled: !busy,
            minLines: 1,
            maxLines: 4,
            textInputAction: TextInputAction.send,
            onSubmitted: (_) => _send(),
            decoration: const InputDecoration(
              hintText: 'اكتب سؤالك الدراسي',
              border: OutlineInputBorder(),
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.xs),
        IconButton.filled(
          tooltip: 'إرسال',
          onPressed: busy ? null : _send,
          icon: const Icon(Icons.send_rounded),
        ),
      ],
    ),
  );

  void _send() {
    final message = _messageController.text.trim();
    if (message.isEmpty) return;
    ref.read(assistantProvider.notifier).chat(message);
    _messageController.clear();
  }

  Widget _errorCard(String message) => AppCard(
    backgroundColor: AppColors.lightError,
    child: Column(
      children: [
        Text(message, textAlign: TextAlign.center),
        const SizedBox(height: AppSpacing.sm),
        OutlinedButton.icon(
          onPressed: () => ref.read(assistantProvider.notifier).retryLast(),
          icon: const Icon(Icons.refresh),
          label: const Text('إعادة المحاولة'),
        ),
      ],
    ),
  );

  Widget _labelValue(String label, String value) => Padding(
    padding: const EdgeInsets.only(top: AppSpacing.md),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppTypography.cardTitle),
        const SizedBox(height: 4),
        Text(value),
      ],
    ),
  );

  Widget _sourceCard(AssistantSourceReference source) => Padding(
    padding: const EdgeInsets.only(bottom: AppSpacing.xs),
    child: AppCard(
      child: Row(
        children: [
          const Icon(Icons.menu_book_rounded, color: AppColors.secondaryTeal),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: Text(source.title)),
          if (source.pageNumber != null) Text('ص ${source.pageNumber}'),
        ],
      ),
    ),
  );
}
