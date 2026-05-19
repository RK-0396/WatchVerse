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

  useEffect(() => {
    if (!socket || !localStream || !room) return;

    const createPeerConnection = (targetId: string, isInitiator: boolean) => {
      if (peers.current.has(targetId)) return peers.current.get(targetId)!;

      console.log(`Creating PeerConnection to ${targetId} (Initiator: ${isInitiator})`);
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          // IMPORTANT: For WebRTC to work across different networks (e.g. mobile data vs home Wi-Fi),
          // you need to add a TURN server here. STUN only works for direct P2P when NATs are cooperative.
          // Example: { urls: 'turn:your-turn-server.com', username: 'username', credential: 'password' }
          // {
          //   urls: "turn:global.relay.metered.ca:80",
          //   username: "97c6b3266c1531a2a845027e",
          //   credential: "tzAMnyM0GTp6tall",
          // }
          // TURN fallback
          // {
          //   urls: [
          //     "turn:your-turn-host.pinggy.io:3478?transport=udp",
          //     "turn:your-turn-host.pinggy.io:3478?transport=tcp"
          //   ],
          //   username: "YOUR_USERNAME",
          //   credential: "YOUR_PASSWORD"
          // }
        ],
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
          const offer = await pc.createOffer();
          if (pc.signalingState !== 'stable') return;
          await pc.setLocalDescription(offer);
          socket.emit('SIGNALING', { roomId, targetId, senderId: userId, signal: pc.localDescription });
        } catch (e) {
          console.error('Negotiation error', e);
        } finally {
          (pc as any).makingOffer = false;
        }
      };

      return pc;
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
  }, [socket, roomId, userId, localStream, room]);

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
