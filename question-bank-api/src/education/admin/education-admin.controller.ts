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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
import { UserRole } from '../../generated/prisma/enums';
import { CurriculaService } from '../curricula/curricula.service';
import {
  CreateCurriculumDto,
  CreateGradeDto,
  CreateLessonDto,
  CreateSubjectDto,
  CreateUnitDto,
  ReorderItemsDto,
  SubjectQueryDto,
  UpdateCurriculumDto,
  UpdateGradeDto,
  UpdateLessonDto,
  UpdateSubjectDto,
  UpdateUnitDto,
} from '../dto/education.dto';
import { GradesService } from '../grades/grades.service';
import { LessonsService } from '../lessons/lessons.service';
import {
  SubjectImageService,
  type UploadedSubjectImageFile,
} from '../subjects/subject-image.service';
import { SubjectsService } from '../subjects/subjects.service';
import { UnitsService } from '../units/units.service';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@ApiForbiddenResponse({ description: 'Administrator role is required.' })
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin')
export class EducationAdminController {
  constructor(
    private readonly grades: GradesService,
    private readonly curricula: CurriculaService,
    private readonly subjects: SubjectsService,
    private readonly subjectImages: SubjectImageService,
    private readonly units: UnitsService,
    private readonly lessons: LessonsService,
  ) {}

  @Post('grades')
  @ApiOperation({ summary: 'Create a grade' })
  @ApiCreatedResponse({ description: 'Grade created.' })
  @ApiConflictResponse({ description: 'Grade name or slug already exists.' })
  async createGrade(@Body() dto: CreateGradeDto) {
    return { data: await this.grades.create(dto) };
  }

  @Get('grades')
  @ApiOperation({ summary: 'List grades, including soft-deleted records' })
  async listGrades(@Query() query: PageQueryDto) {
    const result = await this.grades.list(query);
    return { data: result.items, meta: result.meta };
  }

  @Get('grades/:id')
  @ApiOperation({ summary: 'Get a grade by id' })
  @ApiNotFoundResponse({ description: 'Grade not found.' })
  async getGrade(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.grades.get(id) };
  }

  @Patch('grades/:id')
  @ApiOperation({ summary: 'Update a grade' })
  async updateGrade(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGradeDto,
  ) {
    return { data: await this.grades.update(id, dto) };
  }

  @Delete('grades/:id')
  @ApiOperation({ summary: 'Soft-delete a grade' })
  async deleteGrade(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.grades.remove(id) };
  }

  @Post('grades/:id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted grade' })
  async restoreGrade(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.grades.restore(id) };
  }

  @Post('curricula')
  @ApiOperation({ summary: 'Create a curriculum' })
  async createCurriculum(@Body() dto: CreateCurriculumDto) {
    return { data: await this.curricula.create(dto) };
  }

  @Get('curricula')
  @ApiOperation({ summary: 'List curricula, including soft-deleted records' })
  async listCurricula(@Query() query: PageQueryDto) {
    const result = await this.curricula.list(query);
    return { data: result.items, meta: result.meta };
  }

  @Patch('curricula/:id')
  @ApiOperation({ summary: 'Update a curriculum' })
  async updateCurriculum(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCurriculumDto,
  ) {
    return { data: await this.curricula.update(id, dto) };
  }

  @Delete('curricula/:id')
  @ApiOperation({ summary: 'Soft-delete a curriculum' })
  async deleteCurriculum(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.curricula.remove(id) };
  }

  @Post('curricula/:id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted curriculum' })
  async restoreCurriculum(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.curricula.restore(id) };
  }

  @Post('subjects')
  @ApiOperation({ summary: 'Create a subject' })
  async createSubject(@Body() dto: CreateSubjectDto) {
    return { data: await this.subjects.create(dto) };
  }

  @Get('subjects')
  @ApiOperation({ summary: 'List subjects for administration' })
  async listSubjects(@Query() query: SubjectQueryDto) {
    const result = await this.subjects.listAdmin(query);
    return { data: result.items, meta: result.meta };
  }

  @Get('subjects/:id')
  @ApiOperation({ summary: 'Get a subject for administration' })
  async getSubject(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.subjects.getAdmin(id) };
  }

  @Patch('subjects/:id')
  @ApiOperation({ summary: 'Update a subject' })
  async updateSubject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubjectDto,
  ) {
    return { data: await this.subjects.update(id, dto) };
  }

  @Delete('subjects/:id')
  @ApiOperation({ summary: 'Soft-delete a subject' })
  async deleteSubject(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.subjects.remove(id) };
  }

  @Post('subjects/:id/restore')
  @ApiOperation({ summary: 'Restore a subject' })
  async restoreSubject(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.subjects.restore(id) };
  }

  @Post('subjects/:id/publish')
  @ApiOperation({ summary: 'Publish a subject' })
  async publishSubject(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.subjects.publish(id) };
  }

  @Post('subjects/:id/unpublish')
  @ApiOperation({ summary: 'Unpublish a subject' })
  async unpublishSubject(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.subjects.unpublish(id) };
  }

  @Post('subjects/:id/image')
  @ApiOperation({ summary: 'Upload or update cover image for a subject' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadSubjectImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: UploadedSubjectImageFile,
  ) {
    return { data: await this.subjectImages.uploadCoverImage(id, file) };
  }

  @Delete('subjects/:id/image')
  @ApiOperation({ summary: 'Delete cover image for a subject' })
  async deleteSubjectImage(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.subjectImages.deleteCoverImage(id) };
  }

  @Post('units')
  @ApiOperation({ summary: 'Create a unit' })
  async createUnit(@Body() dto: CreateUnitDto) {
    return { data: await this.units.create(dto) };
  }

  @Get('units')
  @ApiOperation({ summary: 'List units for administration' })
  async listUnits(@Query() query: PageQueryDto) {
    const result = await this.units.listAdmin(query);
    return { data: result.items, meta: result.meta };
  }

  @Post('units/reorder')
  @ApiOperation({ summary: 'Reorder units atomically' })
  async reorderUnits(@Body() dto: ReorderItemsDto) {
    return { data: await this.units.reorder(dto) };
  }

  @Patch('units/:id')
  @ApiOperation({ summary: 'Update a unit' })
  async updateUnit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUnitDto,
  ) {
    return { data: await this.units.update(id, dto) };
  }

  @Delete('units/:id')
  @ApiOperation({ summary: 'Soft-delete a unit' })
  async deleteUnit(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.units.remove(id) };
  }

  @Post('units/:id/restore')
  @ApiOperation({ summary: 'Restore a unit' })
  async restoreUnit(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.units.restore(id) };
  }

  @Post('units/:id/publish')
  @ApiOperation({ summary: 'Publish an active unit' })
  async publishUnit(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.units.publish(id) };
  }

  @Post('units/:id/unpublish')
  @ApiOperation({ summary: 'Unpublish a unit' })
  async unpublishUnit(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.units.unpublish(id) };
  }

  @Post('lessons')
  @ApiOperation({ summary: 'Create a lesson' })
  async createLesson(@Body() dto: CreateLessonDto) {
    return { data: await this.lessons.create(dto) };
  }

  @Get('lessons')
  @ApiOperation({ summary: 'List lessons for administration' })
  async listLessons(@Query() query: PageQueryDto) {
    const result = await this.lessons.listAdmin(query);
    return { data: result.items, meta: result.meta };
  }

  @Post('lessons/reorder')
  @ApiOperation({ summary: 'Reorder lessons atomically' })
  async reorderLessons(@Body() dto: ReorderItemsDto) {
    return { data: await this.lessons.reorder(dto) };
  }

  @Patch('lessons/:id')
  @ApiOperation({ summary: 'Update a lesson' })
  async updateLesson(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLessonDto,
  ) {
    return { data: await this.lessons.update(id, dto) };
  }

  @Delete('lessons/:id')
  @ApiOperation({ summary: 'Soft-delete a lesson' })
  async deleteLesson(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.lessons.remove(id) };
  }

  @Post('lessons/:id/restore')
  @ApiOperation({ summary: 'Restore a lesson' })
  async restoreLesson(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.lessons.restore(id) };
  }
  @Post('lessons/:id/publish')
  @ApiOperation({ summary: 'Publish an active lesson' })
  async publishLesson(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.lessons.publish(id) };
  }

  @Post('lessons/:id/unpublish')
  @ApiOperation({ summary: 'Unpublish a lesson' })
  async unpublishLesson(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.lessons.unpublish(id) };
  }
}
