'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useRoomStore } from '@/store/useRoomStore';
import { useSocket } from '@/hooks/useSocket';
import { useWebRTC } from '@/hooks/useWebRTC';
import { UserVideo } from '@/components/media/UserVideo';
import { Chat } from '@/components/chat/Chat';
import { Users, Share2, Settings, Lock, MonitorUp, MonitorOff, MessageSquare, X, Mic, MicOff, Video, VideoOff, PhoneOff, Copy, Check, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const roomId = params.id as string;
  const initialName = searchParams.get('name');
  const passcode = searchParams.get('passcode') || undefined;
  const [showSettings, setShowSettings] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(360);
  const [isResizing, setIsResizing] = useState(false);
  const [allowControl, setAllowControl] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [readMessagesCount, setReadMessagesCount] = useState(0);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [copied, setCopied] = useState(false);
  const [flashMessage, setFlashMessage] = useState<{username: string, content: string} | null>(null);
  const flashTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleActivity = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('keydown', handleActivity);

    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  const urlUsername = searchParams.get('username');
  const [userId, setUserId] = useState<string>('');
  const username = useMemo(() => urlUsername || `Guest_${userId?.substr(0, 4) || ''}`, [urlUsername, userId]);
  const [canShareScreen, setCanShareScreen] = useState<boolean>(false);

  // Generate a stable userId only on the client after mount and set canShareScreen
  useEffect(() => {
    if (!userId) {
      setUserId(Math.random().toString(36).substr(2, 9));
    }
    // Determine screen sharing capability on client
    setCanShareScreen(typeof window !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia);
  }, []);

  const { room, messages } = useRoomStore();
  
  const messagesFromOthers = useMemo(() => messages.filter(m => m.senderId !== userId), [messages, userId]);
  const unreadCount = isChatOpen ? 0 : messagesFromOthers.length - readMessagesCount;

  const { emitChat, emitCreateRoom, emitSignaling, socket } = useSocket(roomId, userId, username, passcode, initialName || undefined);
  const { localStream, streams, screenStreams, shareScreen, isScreenSharing, localScreenStream, activeScreenSharer, peerMediaStates, connectionStates } = useWebRTC(roomId, userId, socket);

  const activeScreenStream = useMemo(() => {
    if (!activeScreenSharer) return null;
    if (activeScreenSharer === userId) return localScreenStream;
    const userStreams = Array.from(screenStreams.entries())
      .filter(([key]) => key.startsWith(`${activeScreenSharer}_`))
      .map(([_, stream]) => stream);
    const uniqueStreams = Array.from(new Set(userStreams));
    const cameraStream = streams.get(activeScreenSharer);
    const nonCameraStreams = uniqueStreams.filter(s => s.id !== cameraStream?.id);
    return nonCameraStreams.length > 0 ? nonCameraStreams[nonCameraStreams.length - 1] : (uniqueStreams[uniqueStreams.length - 1] || null);
  }, [activeScreenSharer, userId, localScreenStream, screenStreams, streams]);

  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => { t.enabled = !isMicMuted; });
      localStream.getVideoTracks().forEach(t => { t.enabled = !isVideoOff; });
    }
  }, [localStream, isMicMuted, isVideoOff]);

  useEffect(() => {
    room?.participants.forEach(p => {
      if (p.id !== userId) emitSignaling(p.id, { type: 'media_state', isMicMuted, isVideoOff });
    });
  }, [isMicMuted, isVideoOff, room?.participants, emitSignaling, userId]);

  useEffect(() => {
    if (isChatOpen) {
      setReadMessagesCount(messagesFromOthers.length);
    } else if (messagesFromOthers.length > readMessagesCount) {
      // Show flash message for the latest message if it's from someone else
      const lastMsg = messagesFromOthers[messagesFromOthers.length - 1];
      if (lastMsg) {
        setFlashMessage({ username: lastMsg.username, content: lastMsg.content });
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = setTimeout(() => setFlashMessage(null), 4000);
      }
    }
  }, [isChatOpen, messagesFromOthers, readMessagesCount]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const roomName = room?.name || 'Room';
      if (unreadCount > 0) {
        document.title = `(${unreadCount}) ${roomName} - WatchVerse`;
      } else {
        document.title = `${roomName} - WatchVerse`;
      }
    }
  }, [unreadCount, room?.name]);

  useEffect(() => {
    const handleSignaling = (data: any) => {
      if (data.signal?.type === 'settings_sync') {
        if (data.signal.allowControl !== undefined) setAllowControl(data.signal.allowControl);
        if (data.signal.darkMode !== undefined) setDarkMode(data.signal.darkMode);
      }
    };
    socket?.on('SIGNALING', handleSignaling);
    return () => { socket?.off('SIGNALING', handleSignaling); };
  }, [socket]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 200 && newWidth < 600) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      setIsResizing(false);
    };
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleAllowControlChange = (val: boolean) => {
    setAllowControl(val);
    room?.participants.forEach(p => { if (p.id !== userId) emitSignaling(p.id, { type: 'settings_sync', allowControl: val }); });
  };
  const handleDarkModeChange = (val: boolean) => {
    setDarkMode(val);
    room?.participants.forEach(p => { if (p.id !== userId) emitSignaling(p.id, { type: 'settings_sync', darkMode: val }); });
  };
  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Wait for userId to be generated and mounted before rendering
  if (!userId || !mounted) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0516]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0516]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary" />
          <div className="text-primary text-xl font-bold">Joining WatchVerse...</div>
        </div>
      </div>
    );
  }

  const allParticipantStreams = Array.from(streams.entries());

  return (
    <div
      className="h-screen flex flex-col bg-[#0a0516] text-white overflow-hidden"
      style={{ filter: darkMode ? 'none' : 'invert(1) hue-rotate(180deg)' }}
    >
      {/* ── TOP BAR ── */}
      <header className="h-14 shrink-0 flex items-center justify-between px-4 bg-black/40 backdrop-blur-xl border-b border-white/5 z-30">
        {/* Left: Logo + Room info */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center font-bold text-white text-xs shadow-lg shrink-0">W</div>
          <h1 className="text-sm font-black tracking-tight text-white/90 truncate max-w-[100px] sm:max-w-none hidden sm:block">{room.name || 'Room'}</h1>
          {/* Room ID badge – tap to copy */}
          <button
            onClick={copyRoomId}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-white/50 hover:bg-white/10 transition-colors"
          >
            {copied ? <Check size={9} className="text-green-400" /> : <Copy size={9} />}
            <span>{roomId}</span>
            {room.settings.isPrivate && <Lock size={8} className="text-primary" />}
          </button>
        </div>

        {/* Right: participants + settings */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-1 text-white/50 text-xs">
            <Users size={12} className="text-primary" />
            <span>{room.participants.length ?? 0}</span>
          </div>
          {/* Share invite */}
          <div className="relative">
            <button
              onClick={() => setShowShare(!showShare)}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors"
            >
              <Share2 size={14} />
            </button>
            {showShare && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-[#0d0720] border border-white/10 rounded-2xl shadow-2xl p-2 z-50">
                <p className="text-[10px] text-white/30 uppercase tracking-widest px-2 mb-1">Share via</p>
                {(() => {
                  const joinUrl = `${window.location.origin}/room/${roomId}${passcode ? `?passcode=${passcode}` : ''}`;
                  return [
                    { label: '💬 WhatsApp', action: () => { const t = encodeURIComponent(`Join WatchVerse! Room: ${roomId} Link: ${joinUrl}`); window.open(`https://wa.me/?text=${t}`, '_blank'); setShowShare(false); } },
                    { label: '📧 Email', action: () => { window.location.href = `mailto:?subject=Join WatchVerse&body=${encodeURIComponent(`Room: ${roomId}\n${joinUrl}`)}`; setShowShare(false); } },
                    { label: '🔗 Copy Link', action: () => { navigator.clipboard.writeText(joinUrl); alert('Link copied!'); setShowShare(false); } },
                  ].map(item => (
                    <button key={item.label} onClick={item.action} className="w-full text-left px-3 py-2 text-sm text-white/70 hover:bg-white/5 rounded-xl transition-colors">
                      {item.label}
                    </button>
                  ));
                })()}
              </div>
            )}
          </div>
          {/* Settings */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors"
            >
              <Settings size={14} />
            </button>
            {showSettings && (
              <div className="absolute right-0 top-full mt-2 w-60 bg-[#0d0720] border border-white/10 rounded-2xl shadow-2xl p-4 z-50">
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Settings</p>
                {[
                  { label: 'Allow Anyone to Control', val: allowControl, onChange: handleAllowControlChange },
                  { label: 'Dark Mode', val: darkMode, onChange: handleDarkModeChange },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between mb-3">
                    <span className="text-sm text-white/70">{item.label}</span>
                    <div className={`w-10 h-5 rounded-full relative cursor-pointer border transition-colors ${item.val ? 'bg-primary/30 border-primary/50' : 'bg-white/10 border-white/20'}`} onClick={() => item.onChange(!item.val)}>
                      <div className={`w-4 h-4 rounded-full absolute top-0.5 shadow transition-all ${item.val ? 'bg-primary right-0.5' : 'bg-white/50 left-0.5'}`} />
                    </div>
                  </div>
                ))}
                <div className="border-t border-white/5 pt-2 mt-1">
                  <button onClick={() => window.location.href = '/'} className="w-full text-left px-2 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors">
                    Leave Room
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* ── DESKTOP LEFT / MOBILE TOP: Screen share + video grid ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Screen share area (only shown when active or on desktop as placeholder) */}
          {(activeScreenStream || !activeScreenStream) && (
            <div className={`relative ${activeScreenStream ? 'flex-1' : 'hidden lg:flex'} flex items-center justify-center bg-black/30`}>
              {activeScreenStream ? (
                <UserVideo
                  stream={activeScreenStream}
                  muted={activeScreenSharer === userId}
                  label={activeScreenSharer === userId ? 'Your Screen' : 'Shared Screen'}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                    <MonitorUp size={36} className="text-primary/50" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">{canShareScreen ? 'Ready to Present' : 'Waiting for Presenter'}</h2>
                  <p className="text-white/40 text-sm max-w-xs mb-6">
                    {canShareScreen ? 'Click "Share Screen" below to start presenting.' : 'Screen sharing must be started from a desktop browser.'}
                  </p>
                  {canShareScreen && (
                    <button
                      onClick={shareScreen}
                      className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary/20 text-primary border border-primary/40 font-bold text-sm hover:bg-primary/30 transition-colors"
                    >
                      <MonitorUp size={18} /> Start Screen Share
                    </button>
                  )}
                  {isScreenSharing && (
                    <button
                      onClick={() => setShowParticipants(true)}
                      className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 text-white border border-white/10 font-bold text-sm hover:bg-white/10 transition-colors"
                    >
                      View Participants
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── VIDEO GRID (mobile: full flex, desktop: inside left panel) ── */}
          <div className={`${activeScreenStream ? 'block h-32 lg:h-auto' : 'flex-1'} lg:flex-none bg-[#0a0516]`}>
            {/* Mobile: grid or row of participants */}
            <div className="h-full lg:hidden p-2">
              {(() => {
                const total = allParticipantStreams.length + 1;
                
                // If screen sharing is active on mobile, use a horizontal scrollbar
                if (activeScreenStream) {
                  const scrollWrapperClass = "flex flex-row gap-2 overflow-x-auto h-full w-full items-center";
                  const childClass = "w-40 shrink-0 aspect-[4/3] min-w-0";
                  return (
                    <div className={scrollWrapperClass}>
                      <UserVideo
                        stream={localStream}
                        muted
                        isLocal
                        label={
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                            <span>YOU</span>
                          </div>
                        }
                        isMicMuted={isMicMuted}
                        isVideoOff={isVideoOff}
                        username={username}
                        className={`${childClass} ${activeScreenSharer === userId ? 'ring-2 ring-primary' : ''}`}
                      />
                      {allParticipantStreams.map(([targetId, stream]) => {
                        const p = room.participants.find(p => p.id === targetId);
                        const mediaState = peerMediaStates[targetId] || { isMicMuted: false, isVideoOff: false };
                        const connState = connectionStates[targetId] || 'new';
                        return (
                          <UserVideo
                            key={targetId}
                            stream={stream}
                            label={
                              <div className="flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  connState === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 
                                  connState === 'checking' ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]' : 
                                  'bg-red-500 shadow-[0_0_8_px_rgba(239,68,68,0.6)]'
                                }`} />
                                <span>{p?.username || 'Guest'}</span>
                              </div>
                            }
                            isMicMuted={mediaState.isMicMuted}
                            isVideoOff={mediaState.isVideoOff}
                            username={p?.username}
                            className={`${childClass} ${activeScreenSharer === targetId ? 'ring-2 ring-primary' : ''}`}
                          />
                        );
                      })}
                    </div>
                  );
                }

                // If no screen sharing, use dynamic, viewport-constrained flex/grid layouts
                let wrapperClass = "flex flex-col gap-2 h-full w-full";
                let childClass = "flex-1 min-h-0 w-full aspect-auto";

                if (total === 1) {
                  wrapperClass = "flex flex-col gap-2 h-full w-full justify-center";
                  childClass = "flex-1 min-h-0 w-full aspect-auto";
                } else if (total === 2) {
                  wrapperClass = "flex flex-col gap-2 h-full w-full justify-center";
                  childClass = "flex-1 min-h-0 w-full aspect-auto";
                } else if (total >= 3) {
                  wrapperClass = "grid grid-cols-2 grid-rows-2 gap-2 h-full w-full";
                  childClass = "h-full w-full aspect-auto min-h-0";
                }

                return (
                  <div className={wrapperClass}>
                    <UserVideo
                      stream={localStream}
                      muted
                      isLocal
                      label={
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                          <span>YOU</span>
                        </div>
                      }
                      isMicMuted={isMicMuted}
                      isVideoOff={isVideoOff}
                      username={username}
                      className={`${childClass} ${activeScreenSharer === userId ? 'ring-2 ring-primary' : ''}`}
                    />
                    {allParticipantStreams.map(([targetId, stream]) => {
                      const p = room.participants.find(p => p.id === targetId);
                      const mediaState = peerMediaStates[targetId] || { isMicMuted: false, isVideoOff: false };
                      const connState = connectionStates[targetId] || 'new';
                      return (
                        <UserVideo
                          key={targetId}
                          stream={stream}
                          label={
                            <div className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                connState === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 
                                connState === 'checking' ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]' : 
                                'bg-red-500 shadow-[0_0_8_px_rgba(239,68,68,0.6)]'
                              }`} />
                              <span>{p?.username || 'Guest'}</span>
                            </div>
                          }
                          isMicMuted={mediaState.isMicMuted}
                          isVideoOff={mediaState.isVideoOff}
                          username={p?.username}
                          className={`${childClass} ${activeScreenSharer === targetId ? 'ring-2 ring-primary' : ''}`}
                        />
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* ── DESKTOP RIGHT SIDEBAR (Laptop) ── */}
        <div 
          className="hidden lg:flex flex-col border-l border-white/5 bg-black/20 backdrop-blur-md z-20"
          style={{ width: `${sidebarWidth}px` }}
        >
          {/* Contract/Expand Line (Resize Handle) */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/50 transition-colors z-30 group"
            onMouseDown={() => setIsResizing(true)}
          >
            <div className="hidden group-hover:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 bg-white/50 rounded-full" />
          </div>
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em]">Live Presence</h3>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[9px] font-bold text-green-500 uppercase">Voice Active</span>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-2">
              <UserVideo 
                stream={localStream} 
                muted 
                isLocal
                label={
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                    <span>YOU</span>
                  </div>
                } 
                isMicMuted={isMicMuted} 
                isVideoOff={isVideoOff} 
                username={username} 
                className={activeScreenSharer === userId ? 'ring-2 ring-primary' : ''} 
              />
              {allParticipantStreams.map(([targetId, stream]) => {
                const p = room.participants.find(p => p.id === targetId);
                const mediaState = peerMediaStates[targetId] || { isMicMuted: false, isVideoOff: false };
                const connState = connectionStates[targetId] || 'new';
                return (
                  <UserVideo 
                    key={targetId} 
                    stream={stream} 
                    label={
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          connState === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 
                          connState === 'checking' ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]' : 
                          'bg-red-500 shadow-[0_0_8_px_rgba(239,68,68,0.6)]'
                        }`} />
                        <span>{p?.username || 'Guest'}</span>
                      </div>
                    } 
                    isMicMuted={mediaState.isMicMuted} 
                    isVideoOff={mediaState.isVideoOff} 
                    username={p?.username} 
                    className={activeScreenSharer === targetId ? 'ring-2 ring-primary animate-pulse' : ''} 
                  />
                );
              })}

            </div>
          </div>

          {/* Desktop chat panel inside sidebar */}
          {isChatOpen && (
            <div className="flex-[2] border-t border-white/5 flex flex-col min-h-0">
              <div className="p-3 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-2">
                  <MessageSquare size={14} className="text-primary" />
                  <span className="text-xs font-bold text-white/80 uppercase tracking-widest">Live Chat</span>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="w-6 h-6 rounded-full flex items-center justify-center text-white/40 hover:bg-white/10 transition-colors">
                  <X size={12} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <Chat messages={messages} onSendMessage={emitChat} currentUserId={userId} />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── FLOATING BOTTOM DOCK ── */}
      <nav className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2 z-30 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Invite */}
          <button
            onClick={() => setShowShare(!showShare)}
            className="flex flex-col items-center gap-1 p-2 rounded-2xl min-w-[56px] transition-colors bg-white/5 hover:bg-white/10"
          >
            <UserPlus size={22} className="text-white/80" />
            <span className="text-[9px] text-white/40">Invite</span>
          </button>

          {/* Mic */}
          <button
            onClick={() => setIsMicMuted(!isMicMuted)}
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl min-w-[56px] transition-colors ${isMicMuted ? 'bg-red-500/20' : 'bg-white/5'}`}
          >
            {isMicMuted ? <MicOff size={22} className="text-red-400" /> : <Mic size={22} className="text-white/80" />}
            <span className="text-[9px] text-white/40">{isMicMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          {/* Camera */}
          <button
            onClick={() => setIsVideoOff(!isVideoOff)}
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl min-w-[56px] transition-colors ${isVideoOff ? 'bg-red-500/20' : 'bg-white/5'}`}
          >
            {isVideoOff ? <VideoOff size={22} className="text-red-400" /> : <Video size={22} className="text-white/80" />}
            <span className="text-[9px] text-white/40">{isVideoOff ? 'Start Cam' : 'Camera'}</span>
          </button>

          {/* Share Screen (only if supported) */}
          {canShareScreen && (
            <button
              onClick={shareScreen}
              className={`flex flex-col items-center gap-1 p-2 rounded-2xl min-w-[56px] transition-colors ${isScreenSharing ? 'bg-primary/20' : 'bg-white/5'}`}
            >
              {isScreenSharing ? <MonitorOff size={22} className="text-primary" /> : <MonitorUp size={22} className="text-white/80" />}
              <span className="text-[9px] text-white/40">{isScreenSharing ? 'Stop' : 'Share'}</span>
            </button>
          )}

          {/* Chat */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="flex flex-col items-center gap-1 p-2 rounded-2xl min-w-[56px] bg-white/5 relative transition-colors"
          >
            <MessageSquare size={22} className="text-white/80" />
            <span className="text-[9px] text-white/40">Chat</span>
            {unreadCount > 0 && !isChatOpen && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white shadow-lg z-20">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Leave */}
          <button
            onClick={() => window.location.href = '/'}
            className="flex flex-col items-center gap-1 p-2 rounded-2xl min-w-[56px] bg-red-500/20 transition-colors"
          >
            <PhoneOff size={22} className="text-red-400" />
            <span className="text-[9px] text-red-400/70">Leave</span>
          </button>
        </div>
      </nav>

      {/* ── MOBILE CHAT SLIDE-UP DRAWER ── */}
      {isChatOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsChatOpen(false)} />
          {/* Drawer */}
          <div className="relative w-full max-w-md mx-auto bg-[#0d0720] border-t border-white/10 rounded-t-3xl shadow-2xl flex flex-col" style={{ height: '70vh' }}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            {/* Header */}
            <div className="px-4 py-2 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-2">
                <MessageSquare size={15} className="text-primary" />
                <span className="text-sm font-bold text-white/80">Live Chat</span>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:bg-white/10 transition-colors">
                <X size={16} />
              </button>
            </div>
            {/* Chat body */}
            <div className="flex-1 overflow-hidden">
              <Chat messages={messages} onSendMessage={emitChat} currentUserId={userId} />
            </div>
          </div>
        </div>
      )}

      {/* Participants overlay for mobile when screen sharing */}
      {showParticipants && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-3xl bg-[#0d0516] rounded-2xl p-4 overflow-y-auto max-h-[80vh]">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-white font-bold">Participants</h3>
              <button onClick={() => setShowParticipants(false)} className="text-white/60 hover:text-white" aria-label="Close">
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <UserVideo stream={localStream} muted isLocal label="YOU" isMicMuted={isMicMuted} isVideoOff={isVideoOff} username={username} className={activeScreenSharer === userId ? 'ring-2 ring-primary' : ''} />
              {allParticipantStreams.map(([targetId, stream]) => {
                const p = room.participants.find(p => p.id === targetId);
                const mediaState = peerMediaStates[targetId] || { isMicMuted: false, isVideoOff: false };
                return (
                  <UserVideo
                    key={targetId}
                    stream={stream}
                    label={p?.username || 'Guest'}
                    isMicMuted={mediaState.isMicMuted}
                    isVideoOff={mediaState.isVideoOff}
                    username={p?.username}
                    className={activeScreenSharer === targetId ? 'ring-2 ring-primary animate-pulse' : ''}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── FLASH MESSAGE (desktop floating) ── */}
      {flashMessage && !isChatOpen && (
        <div className="fixed top-16 right-4 lg:top-auto lg:bottom-6 lg:right-6 z-50 w-64 bg-[#0d0720]/95 backdrop-blur-3xl border border-primary/40 rounded-2xl p-4 shadow-2xl">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{flashMessage.username}</span>
          </div>
          <p className="text-xs text-white/80 line-clamp-2">{flashMessage.content}</p>
        </div>
      )}

      {/* ── DESKTOP FLOATING CHAT BUTTON ── */}
      
    </div>
  );
}
