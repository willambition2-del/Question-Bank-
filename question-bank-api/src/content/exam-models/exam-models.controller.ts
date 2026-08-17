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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma/enums';
import {
  AddExamQuestionDto,
  BulkAddExamQuestionsDto,
  CreateExamModelDto,
  ExamModelQueryDto,
  ReorderExamQuestionsDto,
  UpdateExamModelDto,
} from '../dto/phase-c.dto';
import { ExamModelsService } from './exam-models.service';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('Exam Models')
@ApiBearerAuth('access-token')
@Controller('exam-models')
export class ExamModelsController {
  constructor(private readonly exams: ExamModelsService) {}

  @Get()
  @ApiOperation({ summary: 'List published exam models' })
  async list(
    @Query() query: ExamModelQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const result = await this.exams.listStudent(query, user?.userId);
    return { data: result.items, meta: result.meta };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an exam model without solutions' })
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.exams.getStudent(id) };
  }
}

@ApiTags('Admin Exam Models')
@ApiBearerAuth('access-token')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/exam-models')
export class ExamModelsAdminController {
  constructor(private readonly exams: ExamModelsService) {}

  @Post()
  async create(@Body() dto: CreateExamModelDto) {
    return { data: await this.exams.create(dto) };
  }

  @Get()
  async list(@Query() query: ExamModelQueryDto) {
    const result = await this.exams.listAdmin(query);
    return { data: result.items, meta: result.meta };
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.exams.getAdmin(id) };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExamModelDto,
  ) {
    return { data: await this.exams.update(id, dto) };
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.exams.remove(id) };
  }

  @Post(':id/restore')
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.exams.restore(id) };
  }

  @Post(':id/publish')
  async publish(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.exams.publish(id) };
  }

  @Post(':id/unpublish')
  async unpublish(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.exams.unpublish(id) };
  }

  @Post(':id/questions')
  async addQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddExamQuestionDto,
  ) {
    return { data: await this.exams.addQuestion(id, dto) };
  }

  @Post(':id/questions/bulk')
  async bulkAdd(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BulkAddExamQuestionsDto,
  ) {
    return { data: await this.exams.bulkAdd(id, dto) };
  }

  @Patch(':id/questions/reorder')
  async reorder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderExamQuestionsDto,
  ) {
    return { data: await this.exams.reorder(id, dto) };
  }

  @Delete(':id/questions/:questionId')
  async removeQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
  ) {
    return { data: await this.exams.removeQuestion(id, questionId) };
  }
}
