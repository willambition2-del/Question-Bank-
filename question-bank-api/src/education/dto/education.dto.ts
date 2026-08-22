import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PageQueryDto } from '../../common/pagination/page-query.dto';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const optionalTrim = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
};
const optionalBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === undefined) return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};

export class CreateGradeDto {
  @ApiProperty({ example: 'الثالث الثانوي' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'grade-12' })
  @Transform(trim)
  @IsString()
  @Matches(SLUG_PATTERN)
  @MaxLength(100)
  slug!: string;

  @ApiPropertyOptional()
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateGradeDto extends PartialType(CreateGradeDto) {}

export class CreateCurriculumDto {
  @ApiProperty({ example: 'المنهج اليمني' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'yemeni-curriculum' })
  @Transform(trim)
  @IsString()
  @Matches(SLUG_PATTERN)
  @MaxLength(100)
  slug!: string;

  @ApiProperty({ example: 'YE' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(2, 2)
  countryCode!: string;

  @ApiPropertyOptional({ example: '2026/2027' })
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  academicYear?: string;

  @ApiPropertyOptional()
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCurriculumDto extends PartialType(CreateCurriculumDto) {}

export class CreateSubjectDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  curriculumId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  gradeId!: string;

  @ApiProperty({ example: 'الفيزياء' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'physics' })
  @Transform(trim)
  @IsString()
  @Matches(SLUG_PATTERN)
  @MaxLength(100)
  slug!: string;

  @ApiPropertyOptional()
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 'physics' })
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  iconKey?: string;

  @ApiPropertyOptional({ example: '#315BE8' })
  @IsOptional()
  @IsHexColor()
  colorHex?: string;

  @ApiPropertyOptional({ example: 'https://example.com/cover.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImageUrl?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateSubjectDto extends PartialType(CreateSubjectDto) {}

export class CreateUnitDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  subjectId!: string;

  @ApiProperty({ example: 'الميكانيكا' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'mechanics' })
  @Transform(trim)
  @IsString()
  @Matches(SLUG_PATTERN)
  @MaxLength(100)
  slug!: string;

  @ApiPropertyOptional()
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateUnitDto extends PartialType(CreateUnitDto) {}

export class CreateLessonDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  subjectId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId!: string;

  @ApiProperty({ example: 'الحركة الخطية' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: 'linear-motion' })
  @Transform(trim)
  @IsString()
  @Matches(SLUG_PATTERN)
  @MaxLength(100)
  slug!: string;

  @ApiPropertyOptional()
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  summary?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateLessonDto extends PartialType(CreateLessonDto) {}

export enum SubjectSort {
  SORT_ORDER = 'sortOrder',
  NAME = 'name',
  QUESTIONS_DESC = 'questions_desc',
  PROGRESS_DESC = 'progress_desc',
  PROGRESS_ASC = 'progress_asc',
  RECENT_ACTIVITY = 'recent_activity',
}

export class SubjectQueryDto extends PageQueryDto {
  @ApiPropertyOptional()
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ type: Boolean })
  @Transform(optionalBoolean)
  @IsOptional()
  @IsBoolean()
  favorite?: boolean;

  @ApiPropertyOptional({ enum: SubjectSort, default: SubjectSort.SORT_ORDER })
  @IsOptional()
  @IsEnum(SubjectSort)
  sort: SubjectSort = SubjectSort.SORT_ORDER;
}

export class ReorderItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class ReorderItemsDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}
