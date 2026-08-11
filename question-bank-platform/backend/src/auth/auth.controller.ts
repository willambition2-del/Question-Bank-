import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  AuthResponse,
  MessageResponse,
} from '../common/interfaces/auth-response.interface';
import { PublicUser } from '../common/types/public-user.type';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { AuthResponseDto, MessageResponseDto } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { GoogleAuthService } from './google-auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { PublicUserDto } from '../users/dto/public-user.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleAuthService: GoogleAuthService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Register a new student account' })
  @ApiCreatedResponse({
    description: 'The student account was created.',
    type: AuthResponseDto,
  })
  @ApiConflictResponse({
    description: 'The username or phone is already in use.',
  })
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Sign in with username or phone' })
  @ApiOkResponse({
    description: 'Authentication succeeded.',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials.',
  })
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('google')
  @ApiOperation({
    summary: 'Sign in or register with a verified Google ID token',
  })
  @ApiOkResponse({
    description: 'Google authentication succeeded.',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'GOOGLE_EMAIL_NOT_VERIFIED or invalid request.',
  })
  @ApiUnauthorizedResponse({
    description:
      'GOOGLE_TOKEN_INVALID, GOOGLE_TOKEN_EXPIRED, or GOOGLE_TOKEN_AUDIENCE_INVALID.',
  })
  @ApiConflictResponse({ description: 'GOOGLE_ACCOUNT_LINK_REQUIRED.' })
  @ApiServiceUnavailableResponse({ description: 'SOCIAL_PROVIDER_DISABLED.' })
  google(@Body() dto: GoogleAuthDto): Promise<AuthResponse> {
    return this.googleAuthService.login(dto.idToken);
  }
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate a refresh token' })
  @ApiOkResponse({
    description: 'A new token pair was issued.',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'The refresh token is invalid or expired.',
  })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponse> {
    return this.authService.refresh(dto.refreshToken);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Sign out and invalidate all tokens' })
  @ApiOkResponse({
    description: 'The current session was invalidated.',
    type: MessageResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid access token is required.',
  })
  logout(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<MessageResponse> {
    return this.authService.logout(currentUser.userId);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiOkResponse({
    description: 'The current authenticated user.',
    type: PublicUserDto,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid access token is required.',
  })
  me(@CurrentUser() currentUser: AuthenticatedUser): Promise<PublicUser> {
    return this.authService.getCurrentUser(currentUser.userId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Change the password and invalidate all sessions',
  })
  @ApiOkResponse({
    description: 'The password was changed. Sign in again to continue.',
    type: MessageResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'The current password or token is invalid.',
  })
  changePassword(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<MessageResponse> {
    return this.authService.changePassword(currentUser.userId, dto);
  }
}
