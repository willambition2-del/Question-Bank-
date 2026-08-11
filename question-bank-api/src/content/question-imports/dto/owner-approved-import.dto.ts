import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { OWNER_APPROVED_FULL_IMPORT } from '../trusted-question-database-import.service';

export class OwnerApprovedImportDto {
  @ApiProperty({
    enum: [OWNER_APPROVED_FULL_IMPORT],
    description: 'Explicit irreversible owner approval phrase',
  })
  @IsIn([OWNER_APPROVED_FULL_IMPORT])
  confirmation!: typeof OWNER_APPROVED_FULL_IMPORT;
}
