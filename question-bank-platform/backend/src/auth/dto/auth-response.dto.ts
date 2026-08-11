import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublicUserDto } from '../../users/dto/public-user.dto';

export class AuthTokensDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ example: '15m' })
  accessTokenExpiresIn!: string;

  @ApiProperty({ example: '30d' })
  refreshTokenExpiresIn!: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: PublicUserDto })
  user!: PublicUserDto;

  @ApiProperty({ type: AuthTokensDto })
  tokens!: AuthTokensDto;

  @ApiPropertyOptional({ default: false })
  isNewUser?: boolean;
}

export class MessageResponseDto {
  @ApiProperty()
  message!: string;
}
