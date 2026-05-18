import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRoomStore } from '@/store/useRoomStore';
import { SyncMessage, Room, ChatMessage } from '@watchverse/types';

const getSocketUrl = () => {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
};

export const useSocket = (roomId: string, userId: string, username: string, passcode?: string) => {
  const socketRef = useRef<Socket | null>(null);
  const { setRoom, updateMedia, addMessage, removeParticipant, addParticipant } = useRoomStore();

  useEffect(() => {
    if (!roomId || !userId) return;

    const socket = io(getSocketUrl(), {
      path: '/api/socket'
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to socket server');
      socket.emit('JOIN_ROOM', { roomId, userId, username, passcode });
    });

    socket.on('ROOM_STATE', (room: Room) => {
      setRoom(room);
    });

    socket.on('SYNC_EVENT', (data: SyncMessage) => {
      updateMedia(data.payload);
    });

    socket.on('CHAT_MESSAGE', (message: ChatMessage) => {
      addMessage(message);
    });

    socket.on('USER_JOINED', (data: { userId: string; username: string }) => {
      addParticipant({ id: data.userId, username: data.username, status: 'online' });
    });

    socket.on('USER_LEFT', (data: { userId: string }) => {
      removeParticipant(data.userId);
    });

    socket.on('ERROR', (err: { message: string }) => {
      alert(err.message);
      window.location.href = '/';
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, userId, username, passcode, setRoom, updateMedia, addMessage, addParticipant, removeParticipant]);

  const emitCreateRoom = useCallback((name: string) => {
    if (socketRef.current) {
      socketRef.current.emit('CREATE_ROOM', { roomId, name, userId, username, passcode });
    }
  }, [roomId, userId, username, passcode]);

  const emitSync = useCallback((type: SyncMessage['type'], payload: SyncMessage['payload']) => {
    if (socketRef.current) {
      const syncData: SyncMessage = {
        roomId,
        userId,
        type,
        payload,
        timestamp: Date.now(),
      };
      socketRef.current.emit('SYNC_EVENT', syncData);
    }
  }, [roomId, userId]);

  const emitChat = useCallback((content: string) => {
    if (socketRef.current) {
      socketRef.current.emit('CHAT_MESSAGE', { roomId, content, username, userId });
    }
  }, [roomId, username, userId]);

  const emitSignaling = useCallback((targetId: string, signal: any) => {
    if (socketRef.current) {
      socketRef.current.emit('SIGNALING', { roomId, targetId, signal, senderId: userId });
    }
  }, [roomId, userId]);

  return { emitSync, emitChat, emitCreateRoom, emitSignaling, socket: socketRef.current };
};
