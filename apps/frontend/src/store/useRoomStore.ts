import { create } from 'zustand';
import { Room, MediaState, User, ChatMessage } from '@watchverse/types';

interface RoomStore {
  room: Room | null;
  messages: ChatMessage[];
  setRoom: (room: Room) => void;
  updateMedia: (media: Partial<MediaState>) => void;
  addMessage: (message: ChatMessage) => void;
  setParticipants: (users: User[]) => void;
  addParticipant: (user: User) => void;
  removeParticipant: (userId: string) => void;
}

export const useRoomStore = create<RoomStore>((set) => ({
  room: null,
  messages: [],
  setRoom: (room) => set({ room }),
  updateMedia: (media) => 
    set((state) => ({
      room: state.room ? { ...state.room, media: { ...state.room.media, ...media } } : null
    })),
  addMessage: (message) => 
    set((state) => ({ messages: [...state.messages, message] })),
  setParticipants: (users) => 
    set((state) => ({
      room: state.room ? { ...state.room, participants: users } : null
    })),
  addParticipant: (user) =>
    set((state) => ({
      room: state.room 
        ? { ...state.room, participants: [...state.room.participants.filter(p => p.id !== user.id), user] } 
        : null
    })),
  removeParticipant: (userId) =>
    set((state) => ({
      room: state.room 
        ? { ...state.room, participants: state.room.participants.filter(p => p.id !== userId) } 
        : null
    })),
}));
