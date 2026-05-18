import { Injectable } from '@nestjs/common';
import { MediaState, Room, User } from '@watchverse/types';

@Injectable()
export class RoomService {
  private rooms: Map<string, Room> = new Map();

  createRoom(roomId: string, name: string, ownerId: string, passcode?: string): Room {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }

    const newRoom: Room = {
      id: roomId,
      name: name,
      ownerId: ownerId,
      participants: [],
      media: {
        provider: 'youtube',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up',
        playing: false,
        currentTime: 0,
        duration: 212,
        lastUpdated: Date.now(),
      },
      settings: {
        isPrivate: !!passcode,
        password: passcode,
        anyoneCanControl: true,
      },
    };
    this.rooms.set(roomId, newRoom);
    return newRoom;
  }

  getRoomState(roomId: string) {
    return this.rooms.get(roomId);
  }

  addParticipant(roomId: string, user: User) {
    const room = this.rooms.get(roomId);
    if (room) {
      const exists = room.participants.find(p => p.id === user.id);
      if (!exists) {
        room.participants.push(user);
      }
    }
  }

  removeParticipant(roomId: string, userId: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.participants = room.participants.filter(p => p.id !== userId);
    }
  }

  updateRoomMediaState(roomId: string, payload: Partial<MediaState>) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.media = {
        ...room.media,
        ...payload,
        lastUpdated: Date.now(),
      } as MediaState;
    }
  }

  verifyPasscode(roomId: string, passcode?: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    if (!room.settings.isPrivate) return true;
    return room.settings.password === passcode;
  }
}
