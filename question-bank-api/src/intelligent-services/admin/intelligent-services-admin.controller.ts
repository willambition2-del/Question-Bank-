import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
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
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ServiceTaskType, UserRole } from '../../generated/prisma/enums';
import {
  AdminLogQueryDto,
  CreateKnowledgeBaseDto,
  CreateModelDto,
  CreatePromptDto,
  CreateProviderDto,
  CreateRouteDto,
  KnowledgeUploadDto,
  SearchKnowledgeDto,
  UpdateKnowledgeBaseDto,
  UpdateModelDto,
  UpdatePromptDto,
  UpdateProviderDto,
  UpdateRouteDto,
  UpdateUsagePolicyDto,
} from './dto/intelligent-services-admin.dto';
import {
  UpdateAiAssistantSettingsDto,
  UserUsageQueryDto,
} from '../assistant/dto/ai-assistant-settings.dto';
import { IntelligentServicesAdminService } from './intelligent-services-admin.service';

@ApiTags('Admin Intelligent Services')
@ApiBearerAuth('access-token')
@Controller('admin/intelligent-services')
@Roles(UserRole.SUPER_ADMIN)
export class IntelligentServicesAdminController {
  constructor(private readonly admin: IntelligentServicesAdminService) {}

  @Get('assistant-settings')
  @ApiOperation({ summary: 'Get unified AI assistant settings' })
  assistantSettings() {
    return this.data(this.admin.assistantSettings());
  }

  @Patch('assistant-settings')
  @ApiOperation({ summary: 'Update unified AI assistant settings and limits' })
  updateAssistantSettings(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateAiAssistantSettingsDto,
  ) {
    return this.data(this.admin.updateAssistantSettings(actor.userId, dto));
  }

  @Get('user-usage')
  @ApiOperation({ summary: 'List student message consumption for the current reset period' })
  userUsage(@Query() query: UserUsageQueryDto) {
    return this.data(this.admin.userUsage(query));
  }

  @Get('providers')
  providers() {
    return this.data(this.admin.providers());
  }

  @Post('providers')
  createProvider(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateProviderDto,
  ) {
    return this.data(this.admin.createProvider(actor.userId, dto));
  }

  @Get('providers/:id')
  provider(@Param('id', ParseUUIDPipe) id: string) {
    return this.data(this.admin.provider(id));
  }

  @Patch('providers/:id')
  updateProvider(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateProviderDto,
  ) {
    return this.data(this.admin.updateProvider(id, actor.userId, dto));
  }

  @Delete('providers/:id')
  disableProvider(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.data(this.admin.disableProvider(id, actor.userId));
  }

  @Post('providers/:id/test')
  @ApiOperation({ summary: 'Run a private provider connection test' })
  testProvider(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.data(this.admin.testProvider(id, actor.userId));
  }

  @Post('providers/:id/discover-models')
  @ApiOperation({
    summary: 'Discover remote provider models without persisting them',
  })
  discoverProviderModels(@Param('id', ParseUUIDPipe) id: string) {
    return this.data(this.admin.discoverProviderModels(id));
  }

  @Get('readiness')
  @ApiOperation({
    summary: 'Return provider, routing, vector and worker readiness',
  })
  readiness() {
    return this.data(this.admin.readiness());
  }

  @Get('models')
  models() {
    return this.data(this.admin.models());
  }

  @Post('models')
  createModel(@Body() dto: CreateModelDto) {
    return this.data(this.admin.createModel(dto));
  }

  @Patch('models/:id')
  updateModel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateModelDto,
  ) {
    return this.data(this.admin.updateModel(id, dto));
  }

  @Delete('models/:id')
  disableModel(@Param('id', ParseUUIDPipe) id: string) {
    return this.data(this.admin.disableModel(id));
  }

  @Post('models/:id/test')
  testModel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.data(this.admin.testModel(id, actor.userId));
  }

  @Get('routes')
  routes() {
    return this.data(this.admin.routes());
  }

  @Post('routes')
  createRoute(@Body() dto: CreateRouteDto) {
    return this.data(this.admin.createRoute(dto));
  }

  @Patch('routes/:id')
  updateRoute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRouteDto,
  ) {
    return this.data(this.admin.updateRoute(id, dto));
  }

  @Get('prompts')
  prompts() {
    return this.data(this.admin.prompts());
  }

  @Post('prompts')
  createPrompt(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreatePromptDto,
  ) {
    return this.data(this.admin.createPrompt(actor.userId, dto));
  }

  @Patch('prompts/:id')
  updatePrompt(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdatePromptDto,
  ) {
    return this.data(this.admin.updatePrompt(id, actor.userId, dto));
  }

  @Post('prompts/:id/activate')
  activatePrompt(@Param('id', ParseUUIDPipe) id: string) {
    return this.data(this.admin.activatePrompt(id));
  }

  @Get('usage-policies')
  usagePolicies() {
    return this.data(this.admin.usagePolicies());
  }

  @Patch('usage-policies/:taskType')
  usagePolicy(
    @Param('taskType', new ParseEnumPipe(ServiceTaskType))
    taskType: ServiceTaskType,
    @Body() dto: UpdateUsagePolicyDto,
  ) {
    return this.data(this.admin.upsertUsagePolicy(taskType, dto));
  }

  @Get('usage')
  usage() {
    return this.data(this.admin.usageOverview());
  }

  @Get('costs')
  costs() {
    return this.data(this.admin.costs());
  }

  @Get('health')
  health() {
    return this.data(this.admin.health());
  }

  @Get('logs')
  logs(@Query() query: AdminLogQueryDto) {
    return this.data(this.admin.logs(query));
  }

  private async data<T>(value: Promise<T>) {
    return { data: await value };
  }
}

@ApiTags('Admin Knowledge Bases')
@ApiBearerAuth('access-token')
@Controller('admin')
@Roles(UserRole.SUPER_ADMIN)
export class KnowledgeAdminController {
  constructor(private readonly admin: IntelligentServicesAdminService) {}

  @Get('knowledge-bases')
  knowledgeBases() {
    return this.data(this.admin.knowledgeBases());
  }

  @Post('knowledge-bases')
  createKnowledgeBase(@Body() dto: CreateKnowledgeBaseDto) {
    return this.data(this.admin.createKnowledgeBase(dto));
  }

  @Patch('knowledge-bases/:id')
  updateKnowledgeBase(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKnowledgeBaseDto,
  ) {
    return this.data(this.admin.updateKnowledgeBase(id, dto));
  }

  @Delete('knowledge-bases/:id')
  disableKnowledgeBase(@Param('id', ParseUUIDPipe) id: string) {
    return this.data(this.admin.disableKnowledgeBase(id));
  }

  @Post('knowledge-bases/:id/documents')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: 25 * 1024 * 1024 },
    }),
  )
  uploadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: KnowledgeUploadDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'DOCUMENT_FILE_REQUIRED',
        message: 'A document file is required',
      });
    }
    return this.data(this.admin.uploadDocument(id, actor.userId, dto, file));
  }

  @Get('knowledge-bases/:id/documents')
  documents(@Param('id', ParseUUIDPipe) id: string) {
    return this.data(this.admin.documents(id));
  }

  @Get('knowledge-documents/:id')
  document(@Param('id', ParseUUIDPipe) id: string) {
    return this.data(this.admin.document(id));
  }

  @Post('knowledge-documents/:id/reprocess')
  reprocessDocument(@Param('id', ParseUUIDPipe) id: string) {
    return this.data(this.admin.reprocessDocument(id));
  }

  @Delete('knowledge-documents/:id')
  archiveDocument(@Param('id', ParseUUIDPipe) id: string) {
    return this.data(this.admin.archiveDocument(id));
  }

  @Post('knowledge-bases/:id/test-search')
  testSearch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SearchKnowledgeDto,
  ) {
    return this.data(this.admin.testSearch(id, dto));
  }

  private async data<T>(value: Promise<T>) {
    return { data: await value };
  }
}
