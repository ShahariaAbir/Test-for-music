import { usePlayer } from '@/hooks/usePlayer';
import { Music, Play, Pause, SkipBack, SkipForward, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Slider } from '@/components/ui/slider';

function formatTime(sec: number): string {
  if (!sec || !isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function NowPlayingBar() {
  const { currentSong, isPlaying, togglePlay, next, previous, currentTime, duration, seek, setFullScreen } = usePlayer();

  if (!currentSong) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="bg-player-bg/90 backdrop-blur-xl border-t border-border/50 px-3 pt-3 pb-2 relative overflow-visible"
      >
        <div className="flex items-center gap-3">
          {/* Song info - tap to expand */}
          <motion.button
            onClick={() => setFullScreen(true)}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-3 flex-1 min-w-0 text-left"
          >
            <motion.div
              className="w-11 h-11 rounded-lg bg-gradient-to-br from-primary/20 to-secondary flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/10"
              animate={isPlaying ? { rotate: [0, 2, -2, 0] } : {}}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Music className="w-5 h-5 text-primary" />
            </motion.div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate text-foreground">{currentSong.title}</p>
              <p className="text-xs truncate text-muted-foreground">{currentSong.artist}</p>
            </div>
            <motion.div
              animate={{ y: [0, -2, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </motion.div>
          </motion.button>

          {/* Controls */}
          <div className="flex items-center gap-0.5">
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={previous}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <SkipBack className="w-5 h-5" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={togglePlay}
              className="p-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/25"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={isPlaying ? 'pause' : 'play'}
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 90 }}
                  transition={{ duration: 0.15 }}
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </motion.div>
              </AnimatePresence>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={next}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <SkipForward className="w-5 h-5" />
            </motion.button>
          </div>
        </div>

        {/* Seekable progress slider */}
        <div className="mt-2 px-1">
          <Slider
            value={[currentTime]}
            max={duration || 1}
            step={0.1}
            onValueChange={([v]) => seek(v)}
            className="h-5"
          />
        </div>

        {/* Time */}
        <div className="flex justify-between text-[10px] text-muted-foreground font-mono px-1 mt-0.5">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
