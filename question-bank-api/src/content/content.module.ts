import { Module } from '@nestjs/common';
import { FileTypeDetector } from '../common/files/file-type-detector';
import {
  ExamModelsAdminController,
  ExamModelsController,
} from './exam-models/exam-models.controller';
import { ExamModelHierarchyValidator } from './exam-models/exam-model-hierarchy.validator';
import { ExamModelsService } from './exam-models/exam-models.service';
import { QuestionImportsController } from './question-imports/question-imports.controller';
import { QuestionImportsService } from './question-imports/question-imports.service';
import { QuestionImportEngineService } from './question-imports/question-import-engine.service';
import { TrustedQuestionDatabaseImportService } from './question-imports/trusted-question-database-import.service';
import {
  QuestionsAdminController,
  QuestionsController,
} from './questions/questions.controller';
import { QuestionHierarchyValidator } from './questions/question-hierarchy.validator';
import { QuestionsService } from './questions/questions.service';
import { QuestionAdminReportingService } from './questions/question-admin-reporting.service';
import { ReadingPassagesController } from './reading-passages/reading-passages.controller';
import { ReadingPassagesService } from './reading-passages/reading-passages.service';
import {
  SourcesAdminController,
  SourcesController,
} from './sources/sources.controller';
import { SourcesService } from './sources/sources.service';

import { ExcelImportService } from './question-imports/excel-import.service';

@Module({
  controllers: [
    SourcesController,
    SourcesAdminController,
    ReadingPassagesController,
    QuestionsController,
    QuestionsAdminController,
    ExamModelsController,
    ExamModelsAdminController,
    QuestionImportsController,
  ],
  providers: [
    FileTypeDetector,
    SourcesService,
    ReadingPassagesService,
    QuestionsService,
    QuestionAdminReportingService,
    QuestionHierarchyValidator,
    QuestionImportEngineService,
    ExamModelHierarchyValidator,
    ExamModelsService,
    QuestionImportsService,
    QuestionImportEngineService,
    TrustedQuestionDatabaseImportService,
    ExcelImportService,
  ],
  exports: [
    SourcesService,
    ReadingPassagesService,
    QuestionsService,
    QuestionAdminReportingService,
    QuestionHierarchyValidator,
    QuestionImportEngineService,
    TrustedQuestionDatabaseImportService,
    ExamModelHierarchyValidator,
    ExcelImportService,
  ],
})
export class ContentModule {}
