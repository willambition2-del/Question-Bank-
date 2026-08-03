import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { EducationContextService } from './education-context.service';

@ApiTags('Education')
@ApiBearerAuth('access-token')
@Controller('education')
export class EducationController {
  constructor(private readonly contexts: EducationContextService) {}

  @Get('context')
  @ApiOperation({ summary: 'Get the active grade and curriculum context' })
  @ApiOkResponse({ description: 'The active education context.' })
  async getContext() {
    return { data: await this.contexts.getDefaultContext() };
  }
}
