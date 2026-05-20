import { Controller, Get, Query } from '@nestjs/common';
import { TurnService } from './turn.service';
import { randomUUID } from 'crypto';

@Controller('turn-credentials')
export class TurnController {
  constructor(private readonly turnService: TurnService) {}

  /**
   * GET /api/turn-credentials
   * Generates and returns dynamic TURN authentication servers and keys
   */
  @Get()
  getTurnCredentials(@Query('userId') userId?: string) {
    const activeUserId = userId || `anon-${randomUUID()}`;
    return this.turnService.generateCredentials(activeUserId);
  }
}
