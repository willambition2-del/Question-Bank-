import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { PASSWORD_PATTERN } from '../../common/constants/auth.constants';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({
    minLength: 8,
    description: 'Must contain at least one letter and one number.',
  })
  @IsString()
  @Matches(PASSWORD_PATTERN, {
    message:
      'newPassword must be at least 8 characters and contain a letter and a number',
  })
  newPassword!: string;
}
