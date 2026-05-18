export type MediaProvider = 'youtube' | 'spotify' | 'hls' | 'direct' | 'twitch' | 'vimeo';

export interface MediaState {
  provider: MediaProvider;
  url: string;
  title: string;
  thumbnail?: string;
  playing: boolean;
  currentTime: number;
  duration: number;
  lastUpdated: number; // Server timestamp
}

export interface User {
  id: string;
  username: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away';
}

export interface Room {
  id: string;
  name: string;
  ownerId: string;
  participants: User[];
  media: MediaState;
  settings: {
    isPrivate: boolean;
    password?: string;
    anyoneCanControl: boolean;
  };
}

export interface SyncMessage {
  roomId: string;
  userId: string;
  type: 'play' | 'pause' | 'seek' | 'change_media';
  payload: Partial<MediaState>;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  username: string;
  content: string;
  timestamp: number;
}
