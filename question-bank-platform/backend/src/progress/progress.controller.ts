import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { QuizScope } from '../generated/prisma/enums';
import { QuizAttemptsService } from '../quiz/quiz-attempts.service';
import {
  CreateCollectionQuizDto,
  MistakeQueryDto,
  SavedQuestionNoteDto,
  SavedQuestionQueryDto,
} from './dto/progress.dto';
import { MistakesService } from './mistakes.service';
import { SavedQuestionsService } from './saved-questions.service';

const ownershipDescription =
  'JWT ownership is enforced. Missing, hidden, and foreign records use a non-disclosing not-found response.';

@ApiTags('Mistakes')
@ApiBearerAuth('access-token')
@Controller('mistakes')
export class MistakesController {
  constructor(
    private readonly mistakes: MistakesService,
    private readonly attempts: QuizAttemptsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List the current student visible mistakes',
    description:
      'Supports hierarchy, difficulty, wrong-count, mastery, reviewed, pagination and deterministic sorting filters. No answer keys are returned.',
  })
  @ApiResponse({ status: 200, description: ownershipDescription })
  async list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: MistakeQueryDto,
  ) {
    const result = await this.mistakes.list(actor.userId, query);
    return { data: result.items, meta: result.meta };
  }

  @Post('quiz')
  @ApiOperation({
    summary: 'Create a quiz from the current student mistakes',
    description:
      'Delegates to Quiz Engine scope MISTAKES and preserves its visibility and shortage policy.',
  })
  @ApiResponse({ status: 201, description: 'Mistakes quiz attempt created.' })
  @ApiResponse({
    status: 400,
    description: 'COLLECTION_QUIZ_EMPTY or invalid scope.',
  })
  async quiz(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateCollectionQuizDto,
  ) {
    return {
      data: await this.attempts.create(actor.userId, {
        ...dto,
        scope: QuizScope.MISTAKES,
      }),
    };
  }

  @Get(':questionId')
  @ApiOperation({
    summary: 'Get a current student mistake safely',
    description:
      ownershipDescription +
      ' The response excludes solutions and admin fields.',
  })
  @ApiParam({ name: 'questionId', format: 'uuid' })
  @ApiResponse({ status: 404, description: 'MISTAKE_NOT_FOUND' })
  async get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('questionId', ParseUUIDPipe) questionId: string,
  ) {
    return { data: await this.mistakes.get(actor.userId, questionId) };
  }

  @Post(':questionId/mark-mastered')
  @ApiOperation({
    summary: 'Acknowledge review without overriding calculated mastery',
    description:
      'The legacy route name is retained for compatibility. It sets manualReviewedAt only; isMastered remains controlled by the documented mastery formula.',
  })
  @ApiParam({ name: 'questionId', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Review acknowledgement recorded idempotently.',
  })
  @ApiResponse({ status: 404, description: 'MISTAKE_NOT_FOUND' })
  async markReviewed(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('questionId', ParseUUIDPipe) questionId: string,
  ) {
    return { data: await this.mistakes.markReviewed(actor.userId, questionId) };
  }
}

@ApiTags('Saved Questions')
@ApiBearerAuth('access-token')
@Controller('saved-questions')
export class SavedQuestionsController {
  constructor(
    private readonly saved: SavedQuestionsService,
    private readonly attempts: QuizAttemptsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List the current student saved questions',
    description:
      'Supports hierarchy, difficulty, search, pagination and deterministic sorting. Hidden content and answer keys are excluded.',
  })
  @ApiResponse({ status: 200, description: ownershipDescription })
  async list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: SavedQuestionQueryDto,
  ) {
    const result = await this.saved.list(actor.userId, query);
    return { data: result.items, meta: result.meta };
  }

  @Post('quiz')
  @ApiOperation({
    summary: 'Create a quiz from current student saved questions',
    description:
      'Delegates to Quiz Engine scope SAVED and preserves its visibility and shortage policy.',
  })
  @ApiResponse({
    status: 201,
    description: 'Saved-question quiz attempt created.',
  })
  async quiz(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateCollectionQuizDto,
  ) {
    return {
      data: await this.attempts.create(actor.userId, {
        ...dto,
        scope: QuizScope.SAVED,
      }),
    };
  }

  @Post(':questionId')
  @ApiOperation({
    summary: 'Save a visible question idempotently',
    description:
      'Hierarchy is derived on the server. Repeating the request returns the owned saved record and optionally updates the normalized note.',
  })
  @ApiParam({ name: 'questionId', format: 'uuid' })
  @ApiResponse({
    status: 201,
    description: 'Saved safely without solution fields.',
  })
  @ApiResponse({ status: 404, description: 'SAVED_QUESTION_NOT_AVAILABLE' })
  async save(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: SavedQuestionNoteDto,
  ) {
    return { data: await this.saved.save(actor.userId, questionId, dto) };
  }

  @Patch(':questionId')
  @ApiOperation({
    summary: 'Update or clear an owned saved-question note',
    description:
      'Whitespace is trimmed. Empty text or null clears the note. User, question and hierarchy cannot be changed.',
  })
  @ApiParam({ name: 'questionId', format: 'uuid' })
  @ApiResponse({ status: 404, description: 'SAVED_QUESTION_NOT_FOUND' })
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: SavedQuestionNoteDto,
  ) {
    return { data: await this.saved.update(actor.userId, questionId, dto) };
  }

  @Delete(':questionId')
  @ApiOperation({
    summary: 'Remove an owned saved question idempotently',
    description:
      'Deleting an absent or foreign saved row succeeds without disclosing existence. The original Question is never deleted.',
  })
  @ApiParam({ name: 'questionId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Idempotent removal result.' })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('questionId', ParseUUIDPipe) questionId: string,
  ) {
    return { data: await this.saved.remove(actor.userId, questionId) };
  }
}
