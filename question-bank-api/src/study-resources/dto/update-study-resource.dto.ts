import { PartialType } from '@nestjs/swagger';
import { CreateStudyResourceDto } from './create-study-resource.dto';

export class UpdateStudyResourceDto extends PartialType(CreateStudyResourceDto) {}
