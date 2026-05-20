import { Module } from '@nestjs/common';
import { RoomService } from './room.service';
import { RoomGateway } from './room.gateway';
import { TurnService } from './turn.service';
import { TurnController } from './turn.controller';

@Module({
  controllers: [TurnController],
  providers: [RoomService, RoomGateway, TurnService]
})
export class RoomModule {}
