import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  CreateQuizAttemptDto,
  QuizAttemptQueryDto,
  SubmitQuizAnswerDto,
} from './dto/quiz.dto';
import { QuizAttemptsService } from './quiz-attempts.service';

@ApiTags('Quiz Attempts')
@ApiBearerAuth('access-token')
@Controller('quiz-attempts')
export class QuizAttemptsController {
  constructor(private readonly attempts: QuizAttemptsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create and start a quiz attempt',
    description:
      'Validates ownership and visible scope, stores immutable internal snapshots, and returns student-safe questions. If some questions are available, shortage metadata uses INSUFFICIENT_QUESTIONS; zero questions is rejected. مثال: اختبار درس.',
  })
  @ApiResponse({
    status: 201,
    description: 'Attempt created without solutions.',
  })
  @ApiResponse({
    status: 400,
    description:
      'QUIZ_SCOPE_INVALID, QUIZ_SETTINGS_INVALID, or INSUFFICIENT_QUESTIONS.',
  })
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateQuizAttemptDto,
  ) {
    return { data: await this.attempts.create(actor.userId, dto) };
  }

  @Post(':attemptId/answers')
  @ApiOperation({
    summary: 'Record one answer atomically',
    description:
      'Evaluates the immutable snapshot on the server. Identical retries are idempotent; conflicting retries return QUESTION_ALREADY_ANSWERED. AFTER_EACH reveals this answer, while AT_END and DISABLED do not.',
  })
  @ApiResponse({ status: 201, description: 'Answer accepted transactionally.' })
  @ApiResponse({ status: 409, description: 'QUESTION_ALREADY_ANSWERED.' })
  async answer(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() dto: SubmitQuizAnswerDto,
  ) {
    return { data: await this.attempts.answer(actor.userId, attemptId, dto) };
  }

  @Post(':attemptId/complete')
  @ApiOperation({
    summary: 'Complete an owned attempt idempotently',
    description:
      'Recomputes counters from persisted answers and awards completion integrations once.',
  })
  async complete(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
  ) {
    return { data: await this.attempts.complete(actor.userId, attemptId) };
  }

  @Post(':attemptId/abandon')
  @ApiOperation({
    summary: 'Abandon an active owned attempt',
    description:
      'Idempotent for ABANDONED attempts and never grants completion rewards.',
  })
  async abandon(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
  ) {
    return { data: await this.attempts.abandon(actor.userId, attemptId) };
  }

  @Get()
  @ApiOperation({
    summary: 'List the current user quiz history',
    description:
      'Paginated deterministic summaries only; internal snapshots are never returned.',
  })
  async list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QuizAttemptQueryDto,
  ) {
    const result = await this.attempts.list(actor.userId, query);
    return { data: result.items, meta: result.meta };
  }

  @Get(':attemptId/result')
  @ApiOperation({
    summary: 'Get an ended attempt result',
    description:
      'Uses immutable snapshots; correct answers are available only after the attempt ends and remain hidden when explanations are disabled.',
  })
  async result(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
  ) {
    return { data: await this.attempts.result(actor.userId, attemptId) };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an owned attempt safely',
    description:
      'Unanswered questions never expose solutions or internal snapshot data.',
  })
  async get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.attempts.get(actor.userId, id) };
  }
}
