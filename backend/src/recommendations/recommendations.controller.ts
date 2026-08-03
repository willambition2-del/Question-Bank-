import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { QuizScope } from '../generated/prisma/enums';
import { CreateCollectionQuizDto } from '../progress/dto/progress.dto';
import { QuizAttemptsService } from '../quiz/quiz-attempts.service';
import { RecommendationQueryDto } from './dto/recommendation-query.dto';
import { RecommendationService } from './recommendation.service';

@ApiTags('Recommendations')
@ApiBearerAuth('access-token')
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendations: RecommendationService,
    private readonly attempts: QuizAttemptsService,
  ) {}

  @Get()
  async get(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: RecommendationQueryDto,
  ) {
    return { data: await this.recommendations.get(actor.userId, query) };
  }

  @Get('weaknesses')
  async weaknesses(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: RecommendationQueryDto,
  ) {
    return { data: await this.recommendations.weaknesses(actor.userId, query) };
  }

  @Get('lessons')
  async lessons(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: RecommendationQueryDto,
  ) {
    return { data: await this.recommendations.lessons(actor.userId, query) };
  }

  @Get('actions')
  async actions(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: RecommendationQueryDto,
  ) {
    return { data: await this.recommendations.actions(actor.userId, query) };
  }

  @Post('weakness-quiz')
  @ApiOperation({
    summary: 'Create a quiz from the current student weaknesses',
  })
  async weaknessQuiz(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateCollectionQuizDto,
  ) {
    return {
      data: await this.attempts.create(actor.userId, {
        ...dto,
        scope: QuizScope.WEAKNESS,
      }),
    };
  }
}
