import { ServiceUnavailableException, Injectable } from '@nestjs/common';
import type {
  ServiceModel,
  ServiceProvider,
} from '../../generated/prisma/client';
import {
  RoutingStrategy,
  ServiceHealthStatus,
  ServiceRequestStatus,
  ServiceTaskType,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { ProviderCircuitBreakerService } from './provider-circuit-breaker.service';
import { TASK_CAPABILITIES } from './task-capabilities';

type Candidate = {
  id: string;
  routingPolicyId: string;
  priority: number;
  weight: number;
  maxRequestsPerMinute: number | null;
  maxRequestsPerDay: number | null;
  maxCostPerDay: unknown;
  model: ServiceModel & { provider: ServiceProvider };
};

export interface RoutingSelection {
  policy: {
    id: string;
    taskType: ServiceTaskType;
    strategy: RoutingStrategy;
    maxFallbacks: number;
    timeoutMs: number;
    temperature: unknown;
    maxOutputTokens: number;
    systemPromptVersionId: string | null;
    knowledgeBaseId: string | null;
    routingVersion: number;
  };
  candidates: Candidate[];
  excluded: Array<{ modelId: string; reason: string }>;
}

@Injectable()
export class ModelRoutingEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly circuits: ProviderCircuitBreakerService,
  ) {}

  async select(
    taskType: ServiceTaskType,
    inputTokens: number,
  ): Promise<RoutingSelection> {
    const policy = await this.prisma.routingPolicy.findFirst({
      where: { taskType, enabled: true },
      orderBy: { updatedAt: 'desc' },
      include: {
        candidates: {
          where: { enabled: true },
          include: { model: { include: { provider: true } } },
        },
      },
    });
    if (!policy) throw this.unavailable('ROUTING_POLICY_NOT_CONFIGURED');

    const excluded: Array<{ modelId: string; reason: string }> = [];
    const eligible: Candidate[] = [];
    for (const candidate of policy.candidates) {
      const reason = await this.exclusionReason(
        candidate,
        taskType,
        policy.minContextWindow,
        inputTokens,
        policy.maxOutputTokens,
        policy.maxEstimatedCost === null
          ? null
          : Number(policy.maxEstimatedCost),
      );
      if (reason) excluded.push({ modelId: candidate.modelId, reason });
      else eligible.push(candidate);
    }
    if (!eligible.length) throw this.unavailable('NO_CAPABLE_MODEL_AVAILABLE');
    const ordered = this.order(
      eligible,
      policy.strategy,
      inputTokens,
      policy.maxOutputTokens,
      policy.primaryModelId,
    ).slice(0, Math.max(1, policy.maxFallbacks + 1));
    return { policy, candidates: ordered, excluded };
  }

  private async exclusionReason(
    candidate: Candidate,
    taskType: ServiceTaskType,
    minContextWindow: number,
    inputTokens: number,
    outputTokens: number,
    maxEstimatedCost: number | null,
  ): Promise<string | null> {
    const model = candidate.model;
    const provider = model.provider;
    if (!model.enabled || !provider.enabled) return 'DISABLED';
    if (
      model.healthStatus === ServiceHealthStatus.UNAVAILABLE ||
      model.healthStatus === ServiceHealthStatus.DISABLED ||
      provider.healthStatus === ServiceHealthStatus.UNAVAILABLE ||
      provider.healthStatus === ServiceHealthStatus.DISABLED
    ) {
      return 'UNHEALTHY';
    }
    if (!(await this.circuits.canRequest(provider.id))) return 'CIRCUIT_OPEN';
    const required = TASK_CAPABILITIES[taskType];
    if (required.text && !model.supportsText) return 'TEXT_UNSUPPORTED';
    if (required.vision && !model.supportsVision) return 'VISION_UNSUPPORTED';
    if (required.embeddings && !model.supportsEmbeddings)
      return 'EMBEDDINGS_UNSUPPORTED';
    if (required.json && !model.supportsJsonMode) return 'JSON_UNSUPPORTED';
    if (required.reasoning && !model.supportsReasoning)
      return 'REASONING_UNSUPPORTED';
    if (model.contextWindow < Math.max(minContextWindow, inputTokens))
      return 'CONTEXT_TOO_SMALL';
    const estimatedCost =
      (inputTokens * Number(model.inputCostPerMillion) +
        outputTokens * Number(model.outputCostPerMillion)) /
      1_000_000;
    if (maxEstimatedCost !== null && estimatedCost > maxEstimatedCost)
      return 'REQUEST_COST_LIMIT';
    const budgetReason = await this.candidateBudgetReason(candidate);
    if (budgetReason) return budgetReason;
    return null;
  }

  private async candidateBudgetReason(
    candidate: Candidate,
  ): Promise<string | null> {
    const now = new Date();
    const commonWhere = {
      routingPolicyId: candidate.routingPolicyId,
      selectedModelId: candidate.model.id,
      status: ServiceRequestStatus.SUCCEEDED,
    };
    if (
      candidate.maxRequestsPerMinute !== null &&
      candidate.maxRequestsPerMinute > 0
    ) {
      const minuteCount = await this.prisma.serviceRequestLog.count({
        where: {
          ...commonWhere,
          createdAt: { gte: new Date(now.getTime() - 60_000) },
        },
      });
      if (minuteCount >= candidate.maxRequestsPerMinute)
        return 'MODEL_MINUTE_LIMIT';
    }
    const dayStart = new Date(now);
    dayStart.setUTCHours(0, 0, 0, 0);
    if (
      candidate.maxRequestsPerDay !== null &&
      candidate.maxRequestsPerDay > 0
    ) {
      const dayCount = await this.prisma.serviceRequestLog.count({
        where: { ...commonWhere, createdAt: { gte: dayStart } },
      });
      if (dayCount >= candidate.maxRequestsPerDay) return 'MODEL_DAILY_LIMIT';
    }
    if (
      candidate.maxCostPerDay !== null &&
      Number(candidate.maxCostPerDay) > 0
    ) {
      const spend = await this.prisma.serviceRequestLog.aggregate({
        where: { ...commonWhere, createdAt: { gte: dayStart } },
        _sum: { estimatedCost: true },
      });
      if (
        Number(spend._sum.estimatedCost ?? 0) >= Number(candidate.maxCostPerDay)
      ) {
        return 'MODEL_DAILY_COST_LIMIT';
      }
    }
    return null;
  }

  private order(
    candidates: Candidate[],
    strategy: RoutingStrategy,
    inputTokens: number,
    outputTokens: number,
    primaryModelId: string | null,
  ): Candidate[] {
    const score = (candidate: Candidate): number => {
      const model = candidate.model;
      const estimatedCost =
        (inputTokens * Number(model.inputCostPerMillion) +
          outputTokens * Number(model.outputCostPerMillion)) /
        1_000_000;
      switch (strategy) {
        case RoutingStrategy.LOWEST_COST:
          return estimatedCost;
        case RoutingStrategy.LOWEST_LATENCY:
          return model.averageLatencyMs ?? model.latencyClass * 1000;
        case RoutingStrategy.QUALITY_FIRST:
          return -model.qualityClass;
        case RoutingStrategy.BALANCED:
          return (
            estimatedCost * 1000 +
            (model.averageLatencyMs ?? model.latencyClass * 1000) / 1000 -
            model.qualityClass * 10
          );
        case RoutingStrategy.WEIGHTED:
          return Math.random() / Math.max(1, candidate.weight);
        case RoutingStrategy.PRIORITY:
          return candidate.priority;
      }
    };
    return [...candidates].sort((left, right) => {
      if (left.model.id === primaryModelId) return -1;
      if (right.model.id === primaryModelId) return 1;
      return score(left) - score(right);
    });
  }

  private unavailable(code: string): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code,
      message: 'The requested platform service is temporarily unavailable',
    });
  }
}
