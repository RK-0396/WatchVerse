'use client';

import React, { useEffect, useRef } from 'react';
import { MediaState } from '@watchverse/types';

interface VideoPlayerProps {
  media: MediaState;
  onSync: (type: 'play' | 'pause' | 'seek', time: number) => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const VideoPlayer = ({ media, onSync }: VideoPlayerProps) => {
  const playerRef = useRef<any>(null);
  const isApiLoaded = useRef(false);

  useEffect(() => {
    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) return;
      
      const videoId = extractVideoId(media.url);
      playerRef.current = new window.YT.Player('yt-player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          autoplay: media.playing ? 1 : 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            const player = event.target;
            if (media.playing && typeof player.playVideo === 'function') {
              player.playVideo();
            }
            if (typeof player.seekTo === 'function') {
              player.seekTo(media.currentTime, true);
            }
          },
          onStateChange: (event: any) => {
            const player = event.target;
            if (typeof player.getCurrentTime === 'function') {
              const time = player.getCurrentTime();
              if (event.data === window.YT.PlayerState.PLAYING) {
                onSync('play', time);
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                onSync('pause', time);
              }
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      if (!document.getElementById('yt-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'yt-api-script';
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }
      
      const prevReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevReady) prevReady();
        initPlayer();
      };
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, []); // Only on mount

  useEffect(() => {
    const player = playerRef.current;
    if (player && typeof player.getPlayerState === 'function') {
      const state = player.getPlayerState();
      
      if (media.playing && state !== 1 && typeof player.playVideo === 'function') {
        player.playVideo();
      } else if (!media.playing && state === 1 && typeof player.pauseVideo === 'function') {
        player.pauseVideo();
      }

      if (typeof player.getCurrentTime === 'function' && typeof player.seekTo === 'function') {
        const currentTime = player.getCurrentTime();
        if (Math.abs(currentTime - media.currentTime) > 2) {
          player.seekTo(media.currentTime, true);
        }
      }
    }
  }, [media]);

  const extractVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : 'dQw4w9WgXcQ';
  };

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden glass shadow-2xl">
      <div id="yt-player" className="w-full h-full" />
    </div>
  );
};
