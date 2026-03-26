import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import type { Song } from '@/lib/db';
import { getAudioBlob } from '@/lib/db';
import { connectAudioElement, resumeAudioContext } from '@/lib/audioEngine';

type RepeatMode = 'off' | 'one' | 'all';

interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  queue: Song[];
  queueIndex: number;
  isFullScreen: boolean;
}

interface PlayerContextType extends PlayerState {
  play: (song: Song, queue?: Song[]) => void;
  setPlaybackState: (playing: boolean) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setFullScreen: (val: boolean) => void;
  refreshCurrentSong: (updates: Partial<Song>) => void;
  audioRef: React.RefObject<HTMLAudioElement>;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}

function updateMediaSession(song: Song) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist,
      album: song.album,
      artwork: [
        { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
  }
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const [state, setState] = useState<PlayerState>({
    currentSong: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    shuffle: false,
    repeat: 'off',
    queue: [],
    queueIndex: -1,
    isFullScreen: false,
  });

  const audioUrlRef = useRef<string | null>(null);

  const playSong = useCallback(async (song: Song) => {
    const blob = await getAudioBlob(song.id);
    if (!blob) return;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const url = URL.createObjectURL(blob);
    audioUrlRef.current = url;
    const audio = audioRef.current;
    audio.src = url;
    audio.volume = state.volume;
    resumeAudioContext();
    try { connectAudioElement(audio); } catch {}
    await audio.play();
    setState(s => ({ ...s, currentSong: song, isPlaying: true }));
    updateMediaSession(song);
  }, [state.volume]);

  const play = useCallback((song: Song, queue?: Song[]) => {
    if (queue) {
      const idx = queue.findIndex(s => s.id === song.id);
      setState(s => ({ ...s, queue, queueIndex: idx >= 0 ? idx : 0 }));
    }
    playSong(song);
  }, [playSong]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (audio.paused) {
      resumeAudioContext();
      audio.play();
      setState(s => ({ ...s, isPlaying: true }));
    } else {
      audio.pause();
      setState(s => ({ ...s, isPlaying: false }));
    }
  }, []);

  const setPlaybackState = useCallback((playing: boolean) => {
    const audio = audioRef.current;
    if (playing) {
      resumeAudioContext();
      audio.play();
      setState(s => ({ ...s, isPlaying: true }));
      return;
    }
    audio.pause();
    setState(s => ({ ...s, isPlaying: false }));
  }, []);

  const getNextIndex = useCallback((currentIndex: number, queue: Song[]): number => {
    if (queue.length === 0) return -1;
    if (state.shuffle) {
      let next = Math.floor(Math.random() * queue.length);
      if (queue.length > 1) while (next === currentIndex) next = Math.floor(Math.random() * queue.length);
      return next;
    }
    return (currentIndex + 1) % queue.length;
  }, [state.shuffle]);

  const next = useCallback(() => {
    const { queue, queueIndex, repeat } = state;
    if (queue.length === 0) return;
    if (repeat === 'one') {
      const audio = audioRef.current;
      audio.currentTime = 0;
      audio.play();
      return;
    }
    const nextIdx = getNextIndex(queueIndex, queue);
    if (nextIdx <= queueIndex && repeat === 'off' && !state.shuffle) {
      audioRef.current.pause();
      setState(s => ({ ...s, isPlaying: false }));
      return;
    }
    setState(s => ({ ...s, queueIndex: nextIdx }));
    playSong(queue[nextIdx]);
  }, [state, getNextIndex, playSong]);

  const previous = useCallback(() => {
    const audio = audioRef.current;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const { queue, queueIndex } = state;
    if (queue.length === 0) return;
    const prevIdx = (queueIndex - 1 + queue.length) % queue.length;
    setState(s => ({ ...s, queueIndex: prevIdx }));
    playSong(queue[prevIdx]);
  }, [state, playSong]);

  const seek = useCallback((time: number) => {
    audioRef.current.currentTime = time;
  }, []);

  const setVolume = useCallback((vol: number) => {
    audioRef.current.volume = vol;
    setState(s => ({ ...s, volume: vol }));
  }, []);

  const toggleShuffle = useCallback(() => {
    setState(s => ({ ...s, shuffle: !s.shuffle }));
  }, []);

  const cycleRepeat = useCallback(() => {
    setState(s => ({
      ...s,
      repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off',
    }));
  }, []);

  const setFullScreen = useCallback((val: boolean) => {
    setState(s => ({ ...s, isFullScreen: val }));
  }, []);

  const refreshCurrentSong = useCallback((updates: Partial<Song>) => {
    setState(s => s.currentSong ? { ...s, currentSong: { ...s.currentSong, ...updates } } : s);
  }, []);

  // Media session action handlers
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => togglePlay());
      navigator.mediaSession.setActionHandler('pause', () => togglePlay());
      navigator.mediaSession.setActionHandler('previoustrack', () => previous());
      navigator.mediaSession.setActionHandler('nexttrack', () => next());
    }
  }, [togglePlay, previous, next]);

  // Time updates
  useEffect(() => {
    const audio = audioRef.current;
    const onTime = () => setState(s => ({ ...s, currentTime: audio.currentTime }));
    const onMeta = () => setState(s => ({ ...s, duration: audio.duration }));
    const onEnded = () => next();
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnded);
    };
  }, [next]);

  return (
    <PlayerContext.Provider value={{
      ...state,
      play, setPlaybackState, togglePlay, next, previous, seek,
      setVolume, toggleShuffle, cycleRepeat, setFullScreen, refreshCurrentSong, audioRef,
    }}>
      {children}
    </PlayerContext.Provider>
  );
}
