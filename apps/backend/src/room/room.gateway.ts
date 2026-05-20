import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { RoomService } from './room.service';
import * as Types from '@watchverse/types';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RoomGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('RoomGateway');
  private userToSocket: Map<string, string> = new Map();

  constructor(private readonly roomService: RoomService) {}

  afterInit(server: Server) {
    this.logger.log('Init');
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const { roomId, userId } = client.data;
    if (userId) this.userToSocket.delete(userId);
    if (roomId && userId) {
      this.roomService.removeParticipant(roomId, userId);
      // Emit USER_LEFT so peers can clean up WebRTC connections
      this.server.to(roomId).emit('USER_LEFT', { userId });
      // Broadcast authoritative updated ROOM_STATE so participant count stays accurate
      const updatedRoom = this.roomService.getRoomState(roomId);
      if (updatedRoom) {
        this.server.to(roomId).emit('ROOM_STATE', updatedRoom);
      }
    }
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  @SubscribeMessage('CREATE_ROOM')
  handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; name: string; userId: string; username?: string; passcode?: string },
  ) {
    const { roomId, name, userId, username, passcode } = data;
    const room = this.roomService.createRoom(roomId, name, userId, passcode);
    
    // Join the creator to the Socket.IO room
    client.join(roomId);
    client.data.roomId = roomId;
    client.data.userId = userId;
    // Update socket mapping (handles reconnect case where socketId changed)
    this.userToSocket.set(userId, client.id);

    // addParticipant is idempotent: it won't duplicate if userId already present
    this.roomService.addParticipant(roomId, { id: userId, username: username || name, status: 'online' });
    this.logger.log(`Room created/joined: ${name} (${roomId}) by ${userId}`);
    
    // Broadcast authoritative ROOM_STATE to all in the room (including creator)
    this.server.to(roomId).emit('ROOM_STATE', this.roomService.getRoomState(roomId));
    return room;
  }

  @SubscribeMessage('JOIN_ROOM')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string; username: string; passcode?: string },
  ) {
    const { roomId, userId, username, passcode } = data;
    
    const room = this.roomService.getRoomState(roomId);
    if (!room) {
      client.emit('ERROR', { message: 'Room not found' });
      return;
    }

    if (!this.roomService.verifyPasscode(roomId, passcode)) {
      client.emit('ERROR', { message: 'Invalid passcode' });
      return;
    }

    client.join(roomId);
    client.data.roomId = roomId;
    client.data.userId = userId;
    // Update socket mapping (handles reconnect case where socketId changed)
    this.userToSocket.set(userId, client.id);

    this.roomService.addParticipant(roomId, { id: userId, username, status: 'online' });
    this.logger.log(`User ${username} joined room ${roomId}`);

    // Notify others about the new peer (used by WebRTC to initiate connection)
    client.to(roomId).emit('USER_JOINED', { userId, username });

    // Broadcast authoritative ROOM_STATE to ALL in the room including the joiner
    // This ensures participant count and list are always in sync on every client
    this.server.to(roomId).emit('ROOM_STATE', this.roomService.getRoomState(roomId));
  }

  @SubscribeMessage('SYNC_EVENT')
  handleSyncEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: Types.SyncMessage,
  ) {
    const { roomId, type, payload } = data;
    this.roomService.updateRoomMediaState(roomId, payload);
    client.to(roomId).emit('SYNC_EVENT', data);
    this.logger.log(`Sync event ${type} in room ${roomId}`);
  }

  @SubscribeMessage('CHAT_MESSAGE')
  handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; content: string; username: string; userId: string },
  ) {
    const { roomId } = data;
    this.server.to(roomId).emit('CHAT_MESSAGE', {
      ...data,
      senderId: data.userId,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('SIGNALING')
  handleSignaling(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; targetId: string; signal: any; senderId: string },
  ) {
    const { targetId } = data;
    const targetSocketId = this.userToSocket.get(targetId);
    if (targetSocketId) {
      this.server.to(targetSocketId).emit('SIGNALING', data);
    }
  }
}
