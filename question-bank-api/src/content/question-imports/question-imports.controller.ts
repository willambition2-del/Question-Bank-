import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
import { QuestionImportRowStatus } from '../../generated/prisma/enums';
import { QuestionImportEngineService } from './question-import-engine.service';
import { TrustedQuestionDatabaseImportService } from './trusted-question-database-import.service';
import { OwnerApprovedImportDto } from './dto/owner-approved-import.dto';
import { UserRole } from '../../generated/prisma/enums';
import {
  QuestionImportsService,
  type UploadedImportFile,
} from './question-imports.service';

import { ExcelImportService } from './excel-import.service';
import type { ExcelImportPreview } from './excel-import.service';
import { GradeLevel } from '../../generated/prisma/enums';
import type { Response } from 'express';
import { Res } from '@nestjs/common';

@ApiTags('Question Imports')
@ApiBearerAuth('access-token')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/question-imports')
export class QuestionImportsController {
  constructor(
    private readonly imports: QuestionImportsService,
    private readonly engine: QuestionImportEngineService,
    private readonly trustedImport: TrustedQuestionDatabaseImportService,
    private readonly excelService: ExcelImportService,
  ) {}

  @Get('templates/questions')
  @ApiOperation({ summary: 'Download questions Excel template (.xlsx)' })
  async downloadQuestionsTemplate(@Res() res: Response) {
    const buffer = await this.excelService.generateQuestionsTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="questions_template.xlsx"',
    );
    res.send(buffer);
  }

  @Get('templates/exam-models')
  @ApiOperation({ summary: 'Download exam models Excel template (.xlsx)' })
  async downloadExamModelsTemplate(@Res() res: Response) {
    const buffer = await this.excelService.generateExamModelsTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="exam_models_template.xlsx"',
    );
    res.send(buffer);
  }

  @Post('excel/preview')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Preview and validate questions from Excel file' })
  async previewExcel(
    @Body('gradeLevel') gradeLevel: GradeLevel,
    @Body('subjectId') subjectId: string,
    @UploadedFile() file?: UploadedImportFile,
  ) {
    if (!file || !file.buffer) {
      throw new Error('الملف مطلوب');
    }
    const preview = await this.excelService.previewExcel(
      file.buffer,
      gradeLevel,
      subjectId,
    );
    return { data: preview };
  }

  @Post('excel/confirm')
  @ApiOperation({ summary: 'Confirm and execute Excel question import' })
  async confirmExcel(
    @CurrentUser() actor: AuthenticatedUser,
    @Body('preview') preview: ExcelImportPreview,
    @Body('unitId') unitId?: string,
    @Body('lessonId') lessonId?: string,
  ) {
    const result = await this.excelService.confirmImport(
      preview,
      actor.userId,
      unitId,
      lessonId,
    );
    return { data: result };
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload a CSV, JSON, XLSX, or ZIP question import' })
  async upload(
    @CurrentUser() actor: AuthenticatedUser,
    @UploadedFile() file?: UploadedImportFile,
  ) {
    return { data: await this.imports.upload(actor.userId, file) };
  }

  @Post(':id/dry-run')
  async dryRun(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.imports.dryRun(id) };
  }
  @Post(':id/validate')
  async validate(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.imports.validate(id) };
  }

  @Post(':id/confirm')
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return { data: await this.engine.confirm(id, actor.userId) };
  }

  @Post(':id/execute')
  async execute(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return { data: await this.engine.confirm(id, actor.userId) };
  }

  @Post(':id/owner-approved-import')
  @ApiOperation({
    summary:
      'Execute the owner-approved canonical SQLite import; structural errors block while content warnings do not',
  })
  async ownerApprovedImport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: OwnerApprovedImportDto,
  ) {
    return {
      data: await this.trustedImport.execute(
        id,
        actor.userId,
        body.confirmation,
      ),
    };
  }
  @Post(':id/owner-approved-resume')
  @ApiOperation({
    summary:
      'Resume an owner-approved import from its persisted source IDs and cursor',
  })
  async ownerApprovedResume(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: OwnerApprovedImportDto,
  ) {
    return {
      data: await this.trustedImport.resume(
        id,
        actor.userId,
        body.confirmation,
      ),
    };
  }
  @Post(':id/pause')
  async pause(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.engine.pause(id) };
  }

  @Post(':id/resume')
  async resume(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return { data: await this.engine.resume(id, actor.userId) };
  }

  @Post(':id/cancel')
  async cancel(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.engine.cancel(id) };
  }

  @Post(':id/rollback')
  async rollback(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return { data: await this.engine.rollback(id, actor.userId) };
  }

  @Get()
  async list(@Query() query: PageQueryDto) {
    const result = await this.imports.list(query);
    return { data: result.items, meta: result.meta };
  }

  @Get(':id/rows')
  async rows(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('status') status?: QuestionImportRowStatus,
  ) {
    const result = await this.engine.rows(
      id,
      Number(page),
      Number(limit),
      status,
    );
    return { data: result.items, meta: result.meta };
  }

  @Get(':id/report')
  async report(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.engine.report(id) };
  }
  @Get(':id/errors')
  async errors(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.imports.errors(id) };
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.imports.get(id) };
  }
}
