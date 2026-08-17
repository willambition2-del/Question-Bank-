import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PublicUser } from '../common/types/public-user.type';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { PublicUserDto } from './dto/public-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'A valid access token is required.' })
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the current user profile' })
  @ApiOkResponse({
    description: 'The current user profile.',
    type: PublicUserDto,
  })
  getProfile(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PublicUser> {
    return this.usersService.getPublicProfile(currentUser.userId);
  }

  @Post('complete-onboarding')
  @ApiOperation({ summary: 'Complete first-time student onboarding' })
  @ApiOkResponse({
    description: 'The completed user profile.',
    type: PublicUserDto,
  })
  completeOnboarding(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CompleteOnboardingDto,
  ): Promise<PublicUser> {
    return this.usersService.completeOnboarding(currentUser.userId, dto);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the current user profile' })
  @ApiOkResponse({
    description: 'The updated user profile.',
    type: PublicUserDto,
  })
  updateProfile(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<PublicUser> {
    return this.usersService.updateProfile(currentUser.userId, dto);
  }
}

