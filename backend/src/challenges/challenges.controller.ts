import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  ChallengeQueryDto,
  CreateChallengeDto,
  InviteChallengeDto,
  MatchmakingDto,
} from './dto/challenge.dto';
import { ChallengesService } from './challenges.service';
import { MatchmakingService } from './matchmaking.service';

@ApiTags('Challenges')
@ApiBearerAuth('access-token')
@Controller('challenges')
export class ChallengesController {
  constructor(
    private readonly challenges: ChallengesService,
    private readonly matchmaking: MatchmakingService,
  ) {}

  @Get('modes')
  modes() {
    return { data: this.challenges.modes() };
  }

  @Post('matchmaking')
  async match(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: MatchmakingDto,
  ) {
    return { data: await this.matchmaking.findOrCreate(actor.userId, dto) };
  }

  @Get('history')
  async history(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ChallengeQueryDto,
  ) {
    const result = await this.challenges.history(actor.userId, query);
    return { data: result.items, meta: result.meta };
  }

  @Post()
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateChallengeDto,
  ) {
    return { data: await this.challenges.create(actor.userId, dto) };
  }

  @Get()
  async list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ChallengeQueryDto,
  ) {
    const result = await this.challenges.list(actor.userId, query);
    return { data: result.items, meta: result.meta };
  }

  @Post(':id/invitations')
  async invite(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteChallengeDto,
  ) {
    return { data: await this.challenges.invite(actor.userId, id, dto) };
  }

  @Post(':id/accept')
  async accept(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return {
      data: await this.challenges.acceptInvitation(actor.userId, id),
    };
  }

  @Post(':id/reject')
  async reject(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return {
      data: await this.challenges.rejectInvitation(actor.userId, id),
    };
  }

  @Post(':id/cancel')
  async cancel(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.challenges.cancel(actor.userId, id) };
  }

  @Get(':id')
  async get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.challenges.get(actor.userId, id) };
  }

  @Post(':id/join')
  async join(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.challenges.join(actor.userId, id) };
  }

  @Post(':id/leave')
  async leave(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.challenges.leave(actor.userId, id) };
  }

  @Post(':id/ready')
  async ready(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.challenges.ready(actor.userId, id) };
  }

  @Get(':id/result')
  async result(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.challenges.result(actor.userId, id) };
  }

  @Post(':id/rematch')
  async rematch(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.challenges.rematch(actor.userId, id) };
  }
}
