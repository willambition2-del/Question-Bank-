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
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { UserRole } from '../../generated/prisma/enums';
import {
  CreateQuestionDto,
  QuestionBulkActionDto,
  RejectQuestionDto,
  ReviewNoteDto,
  UpdateQuestionDto,
} from '../dto/content.dto';
import { QuestionQueryDto } from '../dto/question-bank-query.dto';
import { QuestionsService } from './questions.service';
import {
  QuestionAdminReportingService,
  type QuestionExportFormat,
} from './question-admin-reporting.service';

const CONTENT_ADMIN_ROLES = [UserRole.ADMIN, UserRole.SUPER_ADMIN] as const;
const REVIEW_ROLES = [
  UserRole.REVIEWER,
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
] as const;

@ApiTags('Questions')
@ApiBearerAuth('access-token')
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get a published question without its solution' })
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.questions.getStudent(id) };
  }

  @Get(':id/similar')
  @ApiOperation({ summary: 'Get similar questions without solutions' })
  async similar(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.questions.similar(id) };
  }
}

@ApiTags('Admin Content', 'Question Review')
@ApiBearerAuth('access-token')
@Controller('admin/questions')
export class QuestionsAdminController {
  constructor(
    private readonly questions: QuestionsService,
    private readonly reporting: QuestionAdminReportingService,
  ) {}

  @Post()
  @Roles(...CONTENT_ADMIN_ROLES)
  @ApiOperation({ summary: 'Create a draft question' })
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateQuestionDto,
  ) {
    return { data: await this.questions.create(actor.userId, dto) };
  }

  @Get()
  @Roles(...REVIEW_ROLES)
  @ApiOperation({ summary: 'List questions with administration filters' })
  async list(@Query() query: QuestionQueryDto) {
    const result = await this.questions.listAdmin(query);
    return { data: result.items, meta: result.meta };
  }

  @Get('quality')
  @Roles(...REVIEW_ROLES)
  async quality() {
    return { data: await this.reporting.quality() };
  }

  @Post('export')
  @Roles(UserRole.SUPER_ADMIN)
  async exportQuestions(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('format') format: QuestionExportFormat = 'xlsx',
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!['json', 'csv', 'xlsx'].includes(format)) format = 'xlsx';
    const result = await this.reporting.export(actor.userId, format);
    response.setHeader('Content-Type', result.mime);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.name}"`,
    );
    response.setHeader('X-Export-Row-Count', String(result.count));
    return result.buffer;
  }
  @Get(':id')
  @Roles(...REVIEW_ROLES)
  @ApiOperation({ summary: 'Get a question including review data' })
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.questions.getAdmin(id) };
  }

  @Patch(':id')
  @Roles(...CONTENT_ADMIN_ROLES)
  @ApiOperation({ summary: 'Update a question and return it to draft' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateQuestionDto,
  ) {
    return { data: await this.questions.update(id, actor.userId, dto) };
  }

  @Delete(':id')
  @Roles(...CONTENT_ADMIN_ROLES)
  @ApiOperation({ summary: 'Soft-delete a question' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.questions.remove(id) };
  }

  @Post(':id/restore')
  @Roles(...CONTENT_ADMIN_ROLES)
  @ApiOperation({ summary: 'Restore a question' })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.questions.restore(id) };
  }

  @Post(':id/submit-review')
  @Roles(...REVIEW_ROLES)
  @ApiOperation({ summary: 'Submit a question for review' })
  async submitReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ReviewNoteDto,
  ) {
    return {
      data: await this.questions.submitReview(id, actor.userId, dto.note),
    };
  }

  @Post(':id/approve')
  @Roles(...REVIEW_ROLES)
  @ApiOperation({ summary: 'Approve a reviewed question' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ReviewNoteDto,
  ) {
    return { data: await this.questions.approve(id, actor.userId, dto.note) };
  }

  @Post(':id/reject')
  @Roles(...REVIEW_ROLES)
  @ApiOperation({ summary: 'Reject a reviewed question with a reason' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: RejectQuestionDto,
  ) {
    return { data: await this.questions.reject(id, actor.userId, dto.reason) };
  }

  @Post(':id/archive')
  @Roles(...CONTENT_ADMIN_ROLES)
  @ApiOperation({ summary: 'Archive a question' })
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ReviewNoteDto,
  ) {
    return { data: await this.questions.archive(id, actor.userId, dto.note) };
  }

  @Post(':id/publish')
  @Roles(...CONTENT_ADMIN_ROLES)
  @ApiOperation({ summary: 'Publish a READY question' })
  async publish(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.questions.publish(id) };
  }

  @Post(':id/unpublish')
  @Roles(...CONTENT_ADMIN_ROLES)
  @ApiOperation({ summary: 'Unpublish a question' })
  async unpublish(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.questions.unpublish(id) };
  }

  @Post('bulk-action')
  @Roles(...CONTENT_ADMIN_ROLES)
  @ApiOperation({ summary: 'Apply an action to multiple questions' })
  async bulk(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: QuestionBulkActionDto,
  ) {
    return { data: await this.questions.bulk(actor.userId, dto) };
  }
}
