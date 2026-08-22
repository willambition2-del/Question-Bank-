import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { StudyResourcesService } from './study-resources.service';
import { CreateStudyResourceDto } from './dto/create-study-resource.dto';
import { UpdateStudyResourceDto } from './dto/update-study-resource.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../generated/prisma/enums';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@Controller('study-resources')
export class StudyResourcesController {
  constructor(private readonly studyResourcesService: StudyResourcesService) {}

  @Get('subjects')
  async getSubjectsWithResources(@CurrentUser() currentUser?: AuthenticatedUser) {
    const data = await this.studyResourcesService.getSubjectsWithResources(currentUser?.userId);
    return { data };
  }

  @Get('subjects/:subjectId/resources')
  async getResourcesBySubject(
    @Param('subjectId') subjectId: string,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const data = await this.studyResourcesService.getResourcesBySubject(subjectId, currentUser?.userId);
    return { data };
  }

  @Get(':id/download')
  @UseGuards(JwtAuthGuard)
  getDownloadUrl(@Param('id') id: string) {
    return this.studyResourcesService.getDownloadUrl(id);
  }

  // --- Admin Endpoints ---

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  findAllAdmin(
    @Query('subjectId') subjectId?: string,
    @Query('category') category?: string,
  ) {
    return this.studyResourcesService.findAllAdmin(subjectId, category);
  }

  @Post('admin/upload-url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getUploadUrl(
    @Body('fileName') fileName: string,
    @Body('mimeType') mimeType: string,
  ) {
    return this.studyResourcesService.getUploadUrl(fileName, mimeType);
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  create(@Body() createStudyResourceDto: CreateStudyResourceDto) {
    return this.studyResourcesService.create(createStudyResourceDto);
  }

  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body() updateStudyResourceDto: UpdateStudyResourceDto,
  ) {
    return this.studyResourcesService.update(id, updateStudyResourceDto);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.studyResourcesService.remove(id);
  }

  @Post('admin/:id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  publish(@Param('id') id: string) {
    return this.studyResourcesService.update(id, { isPublished: true });
  }

  @Post('admin/:id/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  unpublish(@Param('id') id: string) {
    return this.studyResourcesService.update(id, { isPublished: false });
  }
}
