import { Module } from '@nestjs/common';
import { QuizModule } from '../quiz/quiz.module';
import { RecommendationService } from './recommendation.service';
import { RecommendationsController } from './recommendations.controller';

@Module({
  imports: [QuizModule],
  controllers: [RecommendationsController],
  providers: [RecommendationService],
  exports: [RecommendationService],
})
export class RecommendationsModule {}
