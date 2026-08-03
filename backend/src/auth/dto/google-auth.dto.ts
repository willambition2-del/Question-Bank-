import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({ description: 'Google OpenID Connect ID token' })
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}
