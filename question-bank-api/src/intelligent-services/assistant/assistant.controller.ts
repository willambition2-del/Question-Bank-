import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { UserRole } from '../../generated/prisma/enums';
import { AssistantService } from './assistant.service';
import { ImageQuestionAnalysisDto } from './image-question.dto';
import { ImageQuestionService } from './image-question.service';
import {
  AssistantChatDto,
  AttemptContextDto,
  KnowledgeAskDto,
} from './dto/assistant.dto';

@ApiTags('Assistant')
@ApiBearerAuth('access-token')
@Controller('assistant')
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly images: ImageQuestionService,
  ) {}

  @Post('images/analyze-question')
  @Roles(UserRole.STUDENT)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  @ApiOperation({ summary: 'Analyze a safely normalized question image' })
  analyzeImage(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ImageQuestionAnalysisDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.data(this.images.analyze(actor.userId, dto, image));
  }

  @Post('chat')
  @ApiOperation({ summary: 'Use the fixed-purpose study assistant' })
  chat(@CurrentUser() actor: AuthenticatedUser, @Body() dto: AssistantChatDto) {
    return this.data(this.assistant.chat(actor.userId, dto));
  }

  @Post('questions/:id/hint')
  @ApiOperation({
    summary: 'Generate a solution-safe hint for a published question',
  })
  hint(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.data(this.assistant.hint(actor.userId, id));
  }

  @Post('questions/:id/explain')
  @ApiOperation({
    summary: 'Explain an answered question when quiz rules permit it',
  })
  explain(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttemptContextDto,
  ) {
    return this.data(this.assistant.explain(actor.userId, id, dto.attemptId));
  }

  @Post('questions/:id/review-answer')
  @ApiOperation({ summary: 'Review an answer from a completed owned attempt' })
  review(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttemptContextDto,
  ) {
    return this.data(
      this.assistant.reviewAnswer(actor.userId, id, dto.attemptId),
    );
  }

  @Post('lessons/:id/summarize')
  @ApiOperation({ summary: 'Summarize a published lesson' })
  summarize(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.data(this.assistant.summarizeLesson(actor.userId, id));
  }

  @Post('lessons/:id/simplify')
  @ApiOperation({ summary: 'Simplify a published lesson' })
  simplify(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.data(this.assistant.simplifyLesson(actor.userId, id));
  }

  @Post('knowledge/ask')
  @ApiOperation({
    summary: 'Answer from an enabled knowledge base with verified citations',
  })
  askKnowledge(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: KnowledgeAskDto,
  ) {
    return this.data(this.assistant.askKnowledge(actor.userId, dto));
  }

  private async data<T>(value: Promise<T>) {
    return { data: await value };
  }
}
