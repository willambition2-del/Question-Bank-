import { ServiceTaskType } from '../../generated/prisma/enums';

export interface TaskCapabilities {
  text: boolean;
  vision: boolean;
  embeddings: boolean;
  json: boolean;
  reasoning: boolean;
}

const TEXT: TaskCapabilities = {
  text: true,
  vision: false,
  embeddings: false,
  json: false,
  reasoning: false,
};

export const TASK_CAPABILITIES: Readonly<
  Record<ServiceTaskType, TaskCapabilities>
> = {
  TEXT_CHAT: TEXT,
  QUESTION_EXPLANATION: TEXT,
  QUESTION_HINT: TEXT,
  ANSWER_REVIEW: { ...TEXT, json: true },
  LESSON_SUMMARY: TEXT,
  LESSON_SIMPLIFICATION: TEXT,
  STUDY_ASSISTANT: TEXT,
  IMAGE_QUESTION_ANALYSIS: { ...TEXT, vision: true, json: true },
  IMAGE_OCR: { ...TEXT, vision: true },
  DOCUMENT_QUESTION_ANSWERING: TEXT,
  MATH_PROBLEM_SOLVING: { ...TEXT, reasoning: true },
  QUESTION_GENERATION: { ...TEXT, json: true },
  QUIZ_GENERATION: { ...TEXT, json: true },
  DISTRACTOR_GENERATION: { ...TEXT, json: true },
  ANSWER_EXPLANATION_GENERATION: { ...TEXT, json: true },
  WRONG_OPTION_EXPLANATION: { ...TEXT, json: true },
  CONTENT_CLASSIFICATION: { ...TEXT, json: true },
  CONTENT_MODERATION: { ...TEXT, json: true },
  RECOMMENDATION_EXPLANATION: TEXT,
  EMBEDDING_GENERATION: {
    text: false,
    vision: false,
    embeddings: true,
    json: false,
    reasoning: false,
  },
  RERANKING: TEXT,
};
