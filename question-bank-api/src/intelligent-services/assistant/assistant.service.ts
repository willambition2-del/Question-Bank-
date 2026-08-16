import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ServiceTaskType } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { IntelligentServicesGateway } from '../intelligent-services.gateway';
import {
  KnowledgeRetrievalService,
  type RetrievedKnowledge,
} from '../knowledge/knowledge-retrieval.service';
import type { AssistantResponse } from '../public-response';
import type { AssistantChatDto, KnowledgeAskDto } from './dto/assistant.dto';
import { AssistantCacheService } from './assistant-cache.service';
import { AssistantResponseValidator } from './assistant-response-validator.service';
import { PromptTemplateService } from './prompt-template.service';
import {
  QuestionContextMode,
  QuestionContextService,
} from './question-context.service';

import { AiAssistantSettingsService } from './ai-assistant-settings.service';

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'summary',
    'steps',
    'keyConcept',
    'commonMistake',
    'sourceReferences',
  ],
  properties: {
    summary: { type: 'string' },
    steps: { type: 'array', items: { type: 'string' } },
    keyConcept: { type: ['string', 'null'] },
    commonMistake: { type: ['string', 'null'] },
    sourceReferences: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['documentId', 'pageNumber'],
        properties: {
          documentId: { type: 'string' },
          pageNumber: { type: ['integer', 'null'] },
        },
      },
    },
  },
};

@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: IntelligentServicesGateway,
    private readonly prompts: PromptTemplateService,
    private readonly questionContext: QuestionContextService,
    private readonly retrieval: KnowledgeRetrievalService,
    private readonly responses: AssistantResponseValidator,
    private readonly cache: AssistantCacheService,
    private readonly aiAssistantSettings: AiAssistantSettingsService,
  ) {}

  getUsage(userId: string) {
    return this.aiAssistantSettings.getUsageStatus(userId);
  }

  chat(userId: string, dto: AssistantChatDto) {
    return this.generate(
      userId,
      ServiceTaskType.STUDY_ASSISTANT,
      JSON.stringify({ studentMessage: dto.message }),
    );
  }

  async hint(userId: string, questionId: string) {
    const context = await this.questionContext.build(
      userId,
      questionId,
      QuestionContextMode.HINT_SAFE,
    );
    return this.generate(
      userId,
      ServiceTaskType.QUESTION_HINT,
      JSON.stringify({
        safetyMode: QuestionContextMode.HINT_SAFE,
        instruction:
          'Give a progressive hint only. Never state or identify the correct answer.',
        question: context,
      }),
    );
  }

  async explain(userId: string, questionId: string, attemptId: string) {
    const context = await this.questionContext.build(
      userId,
      questionId,
      QuestionContextMode.EXPLANATION_AFTER_ANSWER,
      attemptId,
    );
    return this.generate(
      userId,
      ServiceTaskType.QUESTION_EXPLANATION,
      JSON.stringify({ question: context }),
    );
  }

  async reviewAnswer(userId: string, questionId: string, attemptId: string) {
    const context = await this.questionContext.build(
      userId,
      questionId,
      QuestionContextMode.REVIEW_FULL,
      attemptId,
    );
    return this.generate(
      userId,
      ServiceTaskType.ANSWER_REVIEW,
      JSON.stringify({ question: context }),
    );
  }

  async summarizeLesson(userId: string, lessonId: string) {
    return this.lesson(
      userId,
      lessonId,
      ServiceTaskType.LESSON_SUMMARY,
      'Summarize this published lesson for a student.',
    );
  }

  async simplifyLesson(userId: string, lessonId: string) {
    return this.lesson(
      userId,
      lessonId,
      ServiceTaskType.LESSON_SIMPLIFICATION,
      'Simplify this published lesson without changing its facts.',
    );
  }

  async askKnowledge(
    userId: string,
    dto: KnowledgeAskDto,
  ): Promise<AssistantResponse> {
    const requestId = randomUUID();
    const retrieved = await this.retrieval.search(dto.question, {
      knowledgeBaseId: dto.knowledgeBaseId,
      subjectId: dto.subjectId,
      unitId: dto.unitId,
      lessonId: dto.lessonId,
      userId,
      limit: 8,
      minimumScore: 0.15,
    });
    if (!retrieved.length) return this.responses.insufficient(requestId);
    return this.generate(
      userId,
      ServiceTaskType.DOCUMENT_QUESTION_ANSWERING,
      JSON.stringify({
        question: dto.question,
        instruction:
          'Answer only from the supplied excerpts. Cite only their documentId and pageNumber. If they do not support an answer, say so.',
        excerpts: retrieved.map((item) => ({
          documentId: item.documentId,
          pageNumber: item.pageNumber,
          title: item.title,
          content: item.content,
        })),
      }),
      retrieved,
      requestId,
    );
  }

  private async lesson(
    userId: string,
    lessonId: string,
    taskType: ServiceTaskType,
    instruction: string,
  ) {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        isActive: true,
        isPublished: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        summary: true,
        subject: { select: { name: true } },
        unit: { select: { name: true } },
      },
    });
    if (!lesson) {
      throw new NotFoundException({
        code: 'LESSON_NOT_FOUND',
        message: 'Lesson was not found',
      });
    }
    return this.generate(
      userId,
      taskType,
      JSON.stringify({ instruction, lesson }),
      [],
      randomUUID(),
      true,
    );
  }

  private async generate(
    userId: string,
    taskType: ServiceTaskType,
    content: string,
    retrieved: RetrievedKnowledge[] = [],
    requestId = randomUUID(),
    cacheable = false,
  ): Promise<AssistantResponse> {
    const usage = await this.aiAssistantSettings.assertAndConsumeMessage(userId);
    const { template, messages } = await this.prompts.messages(
      taskType,
      content,
    );
    if (cacheable) {
      const cached = await this.cache.get(taskType, content, template.version);
      if (cached) {
        return {
          ...cached,
          requestId,
          usage: {
            remainingToday: usage.remaining,
            remaining: usage.remaining,
            used: usage.used,
            limit: usage.limit,
            resetPeriod: usage.resetPeriod,
            resetAt: usage.resetAt,
          },
        };
      }
    }
    const response = await this.gateway.execute({
      requestId,
      userId,
      taskType,
      messages,
      inputTokens: this.estimateTokens(
        messages.map((item) => item.content).join('\n'),
      ),
      responseSchema: RESPONSE_SCHEMA,
      promptVersion: template.version,
      knowledgeUsed: retrieved.length > 0,
    });
    const normalized = this.responses.normalize(
      requestId,
      response,
      retrieved,
      usage,
    );
    if (cacheable) {
      await this.cache.set(taskType, content, template.version, normalized);
    }
    return normalized;
  }

  private estimateTokens(value: string): number {
    return Math.max(1, Math.ceil(value.length / 4));
  }
}
