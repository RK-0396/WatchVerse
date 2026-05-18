'use client';

import React, { useRef, useEffect, useState } from 'react';
import { MicOff, Maximize } from 'lucide-react';

export const UserVideo = ({ stream, muted = false, label, className, isMicMuted, isVideoOff, username }: { stream: MediaStream | null; muted?: boolean; label: string; className?: string; isMicMuted?: boolean; isVideoOff?: boolean; username?: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.warn('Autoplay prevented on mobile:', e));
    }

    if (!stream || stream.getAudioTracks().length === 0 || isMicMuted) {
      setIsSpeaking(false);
      return;
    }

    let audioContext: AudioContext | null = null;
    let animationFrame: number;
    let speakingTimeout: NodeJS.Timeout | null = null;

    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let currentlySpeaking = false;

      const checkAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        
        if (average > 15) {
          if (!currentlySpeaking) {
            currentlySpeaking = true;
            setIsSpeaking(true);
          }
          if (speakingTimeout) clearTimeout(speakingTimeout);
          speakingTimeout = setTimeout(() => {
            currentlySpeaking = false;
            setIsSpeaking(false);
          }, 800);
        }

        animationFrame = requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();
    } catch (err) {
      console.error('AudioContext error:', err);
    }

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (speakingTimeout) clearTimeout(speakingTimeout);
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(e => console.error(e));
      }
    };
  }, [stream, isMicMuted, isVideoOff]);

  return (
    <div className={`bg-white/5 rounded-2xl relative overflow-hidden border transition-all ${isSpeaking ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)] ring-2 ring-green-500/50' : 'border-white/10'} group ${className || 'aspect-[4/3] hover:scale-[1.02]'}`}>
      {stream && !isVideoOff ? (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted={muted} 
          className={`w-full h-full ${className && className.includes('w-full') ? 'object-contain' : 'object-cover'}`}
        />
      ) : isVideoOff ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
          <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center text-2xl font-bold text-primary">
            {username ? username.charAt(0).toUpperCase() : label.charAt(0).toUpperCase()}
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-white/10">
          <div className="w-12 h-12 rounded-full border-2 border-white/5 border-t-primary animate-spin" />
        </div>
      )}
      <div className="absolute bottom-3 left-3 flex items-center gap-2">
        <div className="px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-black uppercase tracking-wider text-white/80 border border-white/5">
          {label}
        </div>
        {isMicMuted && (
          <div className="p-1 rounded-md bg-red-500/80 backdrop-blur-md text-white shadow-lg">
            <MicOff size={12} />
          </div>
        )}
      </div>

      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button 
          onClick={() => {
            if (videoRef.current) {
              if (videoRef.current.requestFullscreen) {
                videoRef.current.requestFullscreen();
              } else if ((videoRef.current as any).webkitRequestFullscreen) {
                (videoRef.current as any).webkitRequestFullscreen();
              }
            }
          }}
          className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white/80 hover:bg-primary hover:text-white transition-colors border border-white/10 shadow-lg"
          title="Fullscreen"
        >
          <Maximize size={14} />
        </button>
      </div>
    </div>
  );
};
