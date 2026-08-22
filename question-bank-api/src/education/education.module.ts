import { Module } from '@nestjs/common';
import { EducationAdminController } from './admin/education-admin.controller';
import { CurriculaService } from './curricula/curricula.service';
import { EducationContextService } from './education-context.service';
import { EducationController } from './education.controller';
import { GradesService } from './grades/grades.service';
import { LessonsController } from './lessons/lessons.controller';
import { LessonsService } from './lessons/lessons.service';
import { SubjectImageService } from './subjects/subject-image.service';
import { SubjectsController } from './subjects/subjects.controller';
import { SubjectsService } from './subjects/subjects.service';
import { UnitsController } from './units/units.controller';
import { UnitsService } from './units/units.service';

@Module({
  controllers: [
    EducationController,
    SubjectsController,
    UnitsController,
    LessonsController,
    EducationAdminController,
  ],
  providers: [
    EducationContextService,
    GradesService,
    CurriculaService,
    SubjectsService,
    SubjectImageService,
    UnitsService,
    LessonsService,
  ],
  exports: [SubjectsService, SubjectImageService, UnitsService, LessonsService],
})
export class EducationModule {}
