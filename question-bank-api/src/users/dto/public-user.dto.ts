import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanionType, GradeLevel, UserRole } from '../../generated/prisma/enums';

export class PublicUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  username!: string;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty({ enum: CompanionType })
  companion!: CompanionType;

  @ApiPropertyOptional({ nullable: true })
  schoolName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  governorate!: string | null;

  @ApiPropertyOptional({ enum: GradeLevel, nullable: true })
  gradeLevel!: GradeLevel | null;

  @ApiProperty()
  onboardingCompleted!: boolean;

  @ApiProperty()
  isActive!: boolean;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
  })
  lastLoginAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}
