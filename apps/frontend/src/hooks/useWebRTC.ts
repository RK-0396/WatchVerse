import { useEffect, useRef, useState, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import { useRoomStore } from '@/store/useRoomStore';

export const useWebRTC = (roomId: string, userId: string, socket: Socket | null) => {
  const { room } = useRoomStore();
  const [streams, setStreams] = useState<Map<string, MediaStream>>(new Map());
  const [screenStreams, setScreenStreams] = useState<Map<string, MediaStream>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const peers = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activeScreenSharer, setActiveScreenSharer] = useState<string | null>(null);
  const [peerMediaStates, setPeerMediaStates] = useState<Record<string, { isMicMuted: boolean, isVideoOff: boolean }>>({});
  const [connectionStates, setConnectionStates] = useState<Record<string, string>>({});
  
  // Dynamic ICE/TURN configuration state
  const [iceServers, setIceServers] = useState<RTCIceServer[] | null>(null);

  // 1. Fetch secure ephemeral TURN/STUN credentials from NestJS backend
  useEffect(() => {
    let active = true;
    
    const fetchTurnCredentials = async () => {
      try {
        const getApiUrl = () => {
          if (typeof window !== 'undefined') {
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
              return `${window.location.protocol}//${window.location.hostname}:3001`;
            }
            return window.location.origin;
          }
          return 'http://localhost:3001';
        };
        const apiUrl = getApiUrl();
        console.log(`Fetching dynamic TURN credentials from: ${apiUrl}/turn-credentials`);
        
        const res = await fetch(`${apiUrl}/turn-credentials?userId=${userId}`);
        if (!res.ok) throw new Error('Dynamic TURN API returned error response');
        
        const data = await res.json();
        if (active && data && data.iceServers) {
          console.log('Successfully fetched dynamic TURN/STUN servers:', data.iceServers);
          setIceServers(data.iceServers);
        }
      } catch (err) {
        console.error('Failed to fetch TURN credentials, using fallback public STUN:', err);
        if (active) {
          setIceServers([
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
          ]);
        }
      }
    };

    fetchTurnCredentials();
    
    return () => {
      active = false;
    };
  }, [userId]);

  // 2. Initialize Camera and Mic local streams
  useEffect(() => {
    const initLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
      } catch (err) {
        console.warn('Camera access denied or unavailable, using mock stream:', err);
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        const stream = (canvas as any).captureStream(30);

        // Continuously draw to the canvas so the stream actually emits frames
        if (ctx) {
          setInterval(() => {
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, 640, 480);
            ctx.fillStyle = '#8b5cf6';
            ctx.font = '30px Arial';
            ctx.fillText('Camera Offline', 220, 240);

            // Add a small bouncing dot to ensure frames are changing
            const time = Date.now() / 1000;
            const y = 280 + Math.sin(time * 5) * 10;
            ctx.beginPath();
            ctx.arc(320, y, 5, 0, Math.PI * 2);
            ctx.fill();
          }, 1000 / 30);
        }

        setLocalStream(stream);
      }
    };

    if (!localStream) initLocalStream();
  }, [localStream]);

  // 3. Handle Peer Connection setup, signaling, and candidate exchange
  useEffect(() => {
    // Crucial: Wait for dynamic iceServers to be fetched before instantiating peer connections
    if (!socket || !localStream || !room || !iceServers) return;

    const createPeerConnection = (targetId: string, isInitiator: boolean) => {
      if (peers.current.has(targetId)) return peers.current.get(targetId)!;

      console.log(`Creating PeerConnection to ${targetId} (Initiator: ${isInitiator})`);
      const pc = new RTCPeerConnection({
        iceServers: iceServers,
        iceCandidatePoolSize: 20
      });

      peers.current.set(targetId, pc);
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('SIGNALING', { roomId, targetId, senderId: userId, signal: { type: 'candidate', candidate: event.candidate } });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`ICE state with ${targetId}: ${pc.iceConnectionState}`);
        setConnectionStates(prev => ({
          ...prev,
          [targetId]: pc.iceConnectionState
        }));

        // Connection resilience: Trigger ICE restart if connection disconnected
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          console.warn(`Connection lost with ${targetId}, initiating ICE restart...`);
          handleIceRestart(targetId, pc);
        }
      };

      pc.ontrack = (event) => {
        console.log(`Received track from ${targetId}`, event.track.kind);
        const stream = event.streams[0];

        setStreams(prev => {
          const next = new Map(prev);
          const existingStream = next.get(targetId);
          // If we already have a stream and the new track belongs to a different stream ID,
          // it's likely a screen share. Don't overwrite the main camera stream in the grid.
          if (!existingStream || existingStream.id === stream.id) {
            next.set(targetId, stream);
          }
          return next;
        });

        setScreenStreams(prev => {
          const next = new Map(prev);
          // Store every stream received
          next.set(`${targetId}_${stream.id}`, stream);
          return next;
        });
      };

      const polite = !isInitiator;
      // We will attach an object to pc to hold our negotiation state
      (pc as any).makingOffer = false;
      (pc as any).ignoreOffer = false;
      (pc as any).polite = polite;

      pc.onnegotiationneeded = async () => {
        try {
          (pc as any).makingOffer = true;
          // Use argumentless setLocalDescription() for atomic WebRTC engine-level offer creation and state update
          await pc.setLocalDescription();
          socket.emit('SIGNALING', { roomId, targetId, senderId: userId, signal: pc.localDescription });
        } catch (e) {
          console.error('Negotiation error', e);
        } finally {
          (pc as any).makingOffer = false;
        }
      };

      return pc;
    };

    // Connection resilience: Dynamic ICE restart execution
    const handleIceRestart = async (targetId: string, pc: RTCPeerConnection) => {
      try {
        if ((pc as any).makingOffer) return;
        if (pc.signalingState !== 'stable') {
          console.warn(`ICE restart postponed: connection to ${targetId} is in signaling state: ${pc.signalingState}`);
          return;
        }

        console.log(`Executing ICE restart offer for target: ${targetId}`);
        (pc as any).makingOffer = true;

        if (typeof pc.restartIce === 'function') {
          pc.restartIce();
        } else {
          // Fallback to legacy createOffer with iceRestart option if restartIce is not present
          const offer = await pc.createOffer({ iceRestart: true });
          await pc.setLocalDescription(offer);
          socket.emit('SIGNALING', { roomId, targetId, senderId: userId, signal: pc.localDescription });
          return;
        }

        await pc.setLocalDescription();
        socket.emit('SIGNALING', { roomId, targetId, senderId: userId, signal: pc.localDescription });
      } catch (err) {
        console.error('ICE restart error:', err);
      } finally {
        (pc as any).makingOffer = false;
      }
    };

    // Initiate calls to existing participants
    room.participants.forEach(p => {
      if (p.id !== userId && !peers.current.has(p.id)) {
        createPeerConnection(p.id, true);
      }
    });

    const handleUserJoined = (data: { userId: string }) => {
      if (data.userId !== userId && !peers.current.has(data.userId)) {
        createPeerConnection(data.userId, false); // If they join, we are the existing peer, so we wait for their offer. They will be initiator=true.
      }
    };

    const handleSignaling = async (data: { senderId: string; signal: any }) => {
      const { senderId, signal } = data;
      let pc = peers.current.get(senderId);

      if (!pc) {
        // If we get an offer before USER_JOINED, we are receiving, so we are polite
        pc = createPeerConnection(senderId, false);
      }

      const polite = (pc as any).polite;

      try {
        if (signal.type === 'offer') {
          const offerCollision = (pc as any).makingOffer || pc.signalingState !== 'stable';
          (pc as any).ignoreOffer = !polite && offerCollision;
          if ((pc as any).ignoreOffer) {
            console.log('Ignoring colliding offer');
            return;
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          if ((pc as any).candidateQueue) {
            for (const candidate of (pc as any).candidateQueue) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error(e));
            }
            (pc as any).candidateQueue = [];
          }
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('SIGNALING', { roomId, targetId: senderId, senderId: userId, signal: pc.localDescription });
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          if ((pc as any).candidateQueue) {
            for (const candidate of (pc as any).candidateQueue) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error(e));
            }
            (pc as any).candidateQueue = [];
          }
        } else if (signal.type === 'candidate') {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (err) {
            if (!pc.remoteDescription && !(pc as any).ignoreOffer) {
              if (!(pc as any).candidateQueue) (pc as any).candidateQueue = [];
              (pc as any).candidateQueue.push(signal.candidate);
            }
          }
        } else if (signal.type === 'screen_share_start') {
          setActiveScreenSharer(senderId);
        } else if (signal.type === 'screen_share_stop') {
          setActiveScreenSharer(prev => prev === senderId ? null : prev);
        } else if (signal.type === 'media_state') {
          setPeerMediaStates(prev => ({
            ...prev,
            [senderId]: { isMicMuted: signal.isMicMuted, isVideoOff: signal.isVideoOff }
          }));
        }
      } catch (e) {
        console.error('Signaling error:', e);
      }
    };

    socket.on('USER_JOINED', handleUserJoined);
    socket.on('SIGNALING', handleSignaling);

    socket.on('USER_LEFT', (data: { userId: string }) => {
      const pc = peers.current.get(data.userId);
      if (pc) {
        pc.close();
        peers.current.delete(data.userId);
      }
      setStreams(prev => {
        const next = new Map(prev);
        next.delete(data.userId);
        return next;
      });
    });

    return () => {
      socket.off('USER_JOINED', handleUserJoined);
      socket.off('SIGNALING', handleSignaling);
      socket.off('USER_LEFT');
    };
  }, [socket, roomId, userId, localStream, room, iceServers]);

  const stopScreenShare = () => {
    setIsScreenSharing(false);
    if (localScreenStream) {
      localScreenStream.getTracks().forEach(track => track.stop());
      peers.current.forEach((pc, targetId) => {
        localScreenStream.getTracks().forEach(track => {
          const sender = pc.getSenders().find(s => s.track === track);
          if (sender) pc.removeTrack(sender);
        });
        socket?.emit('SIGNALING', { roomId, targetId, senderId: userId, signal: { type: 'screen_share_stop' } });
      });
    }
    setLocalScreenStream(null);
    setActiveScreenSharer(null);
  };

  const shareScreen = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920, max: 3840 },
          height: { ideal: 1080, max: 2160 },
          frameRate: { ideal: 30, max: 60 }
        },
        audio: true
      });

      setLocalScreenStream(screenStream);
      setIsScreenSharing(true);
      setActiveScreenSharer(userId);

      peers.current.forEach((pc, targetId) => {
        screenStream.getTracks().forEach(track => {
          pc.addTrack(track, screenStream);
        });
        socket?.emit('SIGNALING', { roomId, targetId, senderId: userId, signal: { type: 'screen_share_start' } });
      });

      const screenVideoTrack = screenStream.getVideoTracks()[0];
      if (screenVideoTrack) {
        screenVideoTrack.onended = () => {
          stopScreenShare();
        };
      }
    } catch (err: any) {
      console.error('Error sharing screen:', err);
      const name = err?.name || 'Unknown';
      const msg = err?.message || '';
      if (name === 'NotAllowedError') {
        alert('Screen share permission was denied. Please allow screen capture when prompted.');
      } else if (name === 'NotSupportedError' || name === 'TypeError') {
        alert('Screen sharing is not supported on this device/browser. Please use a desktop browser (Chrome, Edge, Firefox) to share your screen.');
      } else {
        alert(`Screen sharing failed: ${name} - ${msg}`);
      }
    }
  };

  return { localStream, streams, screenStreams, shareScreen, isScreenSharing, localScreenStream, activeScreenSharer, peerMediaStates, connectionStates };
};
