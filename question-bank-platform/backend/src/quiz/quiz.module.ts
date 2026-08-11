import { forwardRef, Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { GamificationModule } from '../gamification/gamification.module';
import { ProgressModule } from '../progress/progress.module';
import { QuestionSelectionService } from './question-selection.service';
import { QuizAttemptsController } from './quiz-attempts.controller';
import { QuizAttemptsService } from './quiz-attempts.service';
import { QuizScoringService } from './quiz-scoring.service';
import { QuizScopeValidator } from './quiz-scope.validator';
import { AdminQuizAttemptsController } from './admin/admin-quiz-attempts.controller';
import { AdminQuizAttemptsService } from './admin/admin-quiz-attempts.service';

@Module({
  imports: [
    ContentModule,
    forwardRef(() => ProgressModule),
    GamificationModule,
  ],
  controllers: [QuizAttemptsController, AdminQuizAttemptsController],
  providers: [
    QuestionSelectionService,
    QuizScopeValidator,
    QuizScoringService,
    QuizAttemptsService,
    AdminQuizAttemptsService,
  ],
  exports: [QuestionSelectionService, QuizAttemptsService],
})
export class QuizModule {}
