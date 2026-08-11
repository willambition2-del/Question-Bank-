import { PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UpdateCategory } from '../../generated/prisma/enums';

export class CreateAppUpdateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(10000)
  body!: string;

  @IsEnum(UpdateCategory)
  category!: UpdateCategory;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  actionType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  actionValue?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateAppUpdateDto extends PartialType(CreateAppUpdateDto) {}
