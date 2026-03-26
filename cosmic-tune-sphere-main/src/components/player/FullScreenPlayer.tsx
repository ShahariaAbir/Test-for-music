import { useState, useEffect, useRef } from 'react';
import { usePlayer } from '@/hooks/usePlayer';
import { updateSong, getSongBackground, setSongBackground } from '@/lib/db';
import { Play, Pause, SkipBack, SkipForward, ChevronDown, Shuffle, Repeat, Repeat1, Volume2, Pencil, Check, ImagePlus, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Slider } from '@/components/ui/slider';
import Visualizer from './Visualizer';
import LyricsPanel from './LyricsPanel';
import appIcon from '@/assets/app-icon.png';

function formatTime(sec: number): string {
  if (!sec || !isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function FullScreenPlayer() {
  const {
    currentSong, isPlaying, togglePlay, next, previous,
    currentTime, duration, seek, volume, setVolume,
    shuffle, toggleShuffle, repeat, cycleRepeat,
    isFullScreen, setFullScreen, refreshCurrentSong,
  } = usePlayer();

  const [bgImage, setBgImage] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingArtist, setIsEditingArtist] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [showLyrics, setShowLyrics] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const artistRef = useRef<HTMLInputElement>(null);
  const prevSongIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentSong) return;
    if (prevSongIdRef.current === currentSong.id) return;
    prevSongIdRef.current = currentSong.id;
    getSongBackground(currentSong.id).then(bg => setBgImage(bg));
  }, [currentSong]);

  useEffect(() => {
    if (!isFullScreen) return;
    const onPop = (e: PopStateEvent) => {
      e.preventDefault();
      if (showLyrics) {
        setShowLyrics(false);
      } else {
        setFullScreen(false);
      }
    };
    window.history.pushState({ fullscreen: true }, '');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [isFullScreen, setFullScreen, showLyrics]);

  const handleBgClick = () => fileInputRef.current?.click();

  const handleBgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentSong) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setBgImage(dataUrl);
      setSongBackground(currentSong.id, dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const startEditTitle = () => {
    if (!currentSong) return;
    setEditTitle(currentSong.title);
    setIsEditingTitle(true);
    setTimeout(() => titleRef.current?.focus(), 50);
  };

  const saveTitle = async () => {
    if (currentSong && editTitle.trim()) {
      await updateSong(currentSong.id, { title: editTitle.trim() });
      refreshCurrentSong?.({ title: editTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const startEditArtist = () => {
    if (!currentSong) return;
    setEditArtist(currentSong.artist);
    setIsEditingArtist(true);
    setTimeout(() => artistRef.current?.focus(), 50);
  };

  const saveArtist = async () => {
    if (currentSong && editArtist.trim()) {
      await updateSong(currentSong.id, { artist: editArtist.trim() });
      refreshCurrentSong?.({ artist: editArtist.trim() });
    }
    setIsEditingArtist(false);
  };

  if (!currentSong) return null;

  return (
    <AnimatePresence>
      {isFullScreen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden"
        >
          {/* Ambient glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-accent/5 blur-[100px]" />
          </div>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-between p-4 relative z-10"
          >
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => setFullScreen(false)} className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary/50 transition-all">
              <ChevronDown className="w-6 h-6" />
            </motion.button>
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium">Now Playing</span>
            <div className="flex items-center gap-1">
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => setShowLyrics(!showLyrics)}
                className={`p-2 rounded-full transition-all ${showLyrics ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
                title="View Lyrics"
              >
                <BookOpen className="w-5 h-5" />
              </motion.button>
              <motion.button whileTap={{ scale: 0.85 }} onClick={handleBgClick} className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary/50 transition-all" title="Set image for this song">
                <ImagePlus className="w-5 h-5" />
              </motion.button>
            </div>
          </motion.div>

          {/* Visualizer / Lyrics slide container */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 relative z-10">
            <div className="w-full max-w-md aspect-square relative overflow-hidden">
              <motion.div
                animate={{ x: showLyrics ? '-105%' : '0%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                className="absolute inset-0"
              >
                <div className="w-full h-full rounded-3xl bg-surface/80 overflow-hidden flex flex-col items-center justify-center relative shadow-2xl shadow-black/30 border border-border/30">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img
                      src={bgImage || appIcon}
                      alt="Player background"
                      className={`${bgImage ? 'w-full h-full object-cover' : 'w-3/5 h-3/5 object-contain opacity-20'} transition-opacity duration-500`}
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-black/20" />
                  <div className="w-full h-full flex items-end relative z-10 p-4">
                    <Visualizer isPlaying={isPlaying} />
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleBgChange} className="hidden" />
                </div>
              </motion.div>

              <motion.div
                animate={{ x: showLyrics ? '0%' : '105%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                className="absolute inset-0"
              >
                <LyricsPanel songTitle={currentSong.title} songArtist={currentSong.artist} songId={currentSong.id} isOpen={showLyrics} />
              </motion.div>
            </div>

            {/* Song info */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-center w-full max-w-md space-y-1">
              {isEditingTitle ? (
                <div className="flex items-center gap-2 justify-center">
                  <input ref={titleRef} value={editTitle} onChange={e => setEditTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveTitle()} className="bg-secondary/80 text-foreground text-xl font-semibold text-center rounded-lg px-3 py-1.5 outline-none border border-primary/50 w-full max-w-xs backdrop-blur-sm" />
                  <motion.button whileTap={{ scale: 0.85 }} onClick={saveTitle} className="p-1.5 text-primary bg-primary/10 rounded-full"><Check className="w-5 h-5" /></motion.button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 group">
                  <div className="overflow-hidden max-w-[75%]">
                    <h2 className="text-xl font-bold text-foreground whitespace-nowrap animate-marquee">{currentSong.title}</h2>
                  </div>
                  <motion.button whileTap={{ scale: 0.8 }} onClick={startEditTitle} className="p-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"><Pencil className="w-4 h-4" /></motion.button>
                </div>
              )}

              {isEditingArtist ? (
                <div className="flex items-center gap-2 justify-center">
                  <input ref={artistRef} value={editArtist} onChange={e => setEditArtist(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveArtist()} className="bg-secondary/80 text-muted-foreground text-sm text-center rounded-lg px-3 py-1.5 outline-none border border-primary/50 w-full max-w-xs backdrop-blur-sm" />
                  <motion.button whileTap={{ scale: 0.85 }} onClick={saveArtist} className="p-1.5 text-primary bg-primary/10 rounded-full"><Check className="w-5 h-5" /></motion.button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 group">
                  <p className="text-sm text-muted-foreground truncate">{currentSong.artist} — {currentSong.album}</p>
                  <motion.button whileTap={{ scale: 0.8 }} onClick={startEditArtist} className="p-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"><Pencil className="w-4 h-4" /></motion.button>
                </div>
              )}
            </motion.div>
          </div>

          {/* Controls */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="px-6 pb-8 space-y-4 max-w-md mx-auto w-full relative z-10">
            <div className="space-y-1">
              <Slider value={[currentTime]} max={duration || 1} step={0.1} onValueChange={([v]) => seek(v)} />
              <div className="flex justify-between text-xs text-muted-foreground font-mono tabular-nums">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <motion.button whileTap={{ scale: 0.8 }} onClick={toggleShuffle} className={`p-2 rounded-full transition-all ${shuffle ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}>
                <Shuffle className="w-5 h-5" />
              </motion.button>
              <motion.button whileTap={{ scale: 0.85 }} onClick={previous} className="p-3 text-foreground hover:text-primary transition-colors">
                <SkipBack className="w-7 h-7" fill="currentColor" />
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={togglePlay} className="p-5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xl shadow-primary/30">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={isPlaying ? 'p' : 'r'} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 90 }} transition={{ duration: 0.15 }}>
                    {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                  </motion.div>
                </AnimatePresence>
              </motion.button>
              <motion.button whileTap={{ scale: 0.85 }} onClick={next} className="p-3 text-foreground hover:text-primary transition-colors">
                <SkipForward className="w-7 h-7" fill="currentColor" />
              </motion.button>
              <motion.button whileTap={{ scale: 0.8 }} onClick={cycleRepeat} className={`p-2 rounded-full transition-all ${repeat !== 'off' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}>
                {repeat === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
              </motion.button>
            </div>

            <div className="flex items-center gap-3">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <Slider value={[volume]} max={1} step={0.01} onValueChange={([v]) => setVolume(v)} className="flex-1" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
