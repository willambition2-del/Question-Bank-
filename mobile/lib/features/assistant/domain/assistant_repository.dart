import 'dart:typed_data';

import 'assistant_models.dart';

abstract interface class AssistantRepository {
  Future<ImageQuestionAnalysisResponse> analyzeQuestionImage({
    required Uint8List bytes,
    required String fileName,
    required ImageAnalysisMode mode,
    String? userQuestion,
    void Function(int sent, int total)? onSendProgress,
  });
  Future<AssistantResponse> chat(String message);

  Future<AssistantResponse> questionHint({
    required String questionId,
    required String attemptId,
  });

  Future<AssistantResponse> explainQuestion({
    required String questionId,
    required String attemptId,
  });

  Future<AssistantResponse> reviewAnswer({
    required String questionId,
    required String attemptId,
  });

  Future<AssistantResponse> summarizeLesson(String lessonId);

  Future<AssistantResponse> simplifyLesson(String lessonId);

  Future<AssistantResponse> askKnowledge({
    required String question,
    required String knowledgeBaseId,
    String? subjectId,
    String? unitId,
    String? lessonId,
  });
}
