import { forwardRef, Module } from '@nestjs/common';
import { QuizModule } from '../quiz/quiz.module';
import { MasteryService } from './mastery.service';
import { MistakesService } from './mistakes.service';
import {
  MistakesController,
  SavedQuestionsController,
} from './progress.controller';
import { ProgressReconciliationService } from './progress-reconciliation.service';
import { SavedQuestionsService } from './saved-questions.service';
import { StudentProgressService } from './student-progress.service';

@Module({
  imports: [forwardRef(() => QuizModule)],
  controllers: [MistakesController, SavedQuestionsController],
  providers: [
    MasteryService,
    ProgressReconciliationService,
    StudentProgressService,
    MistakesService,
    SavedQuestionsService,
  ],
  exports: [
    MasteryService,
    StudentProgressService,
    ProgressReconciliationService,
  ],
})
export class ProgressModule {}
