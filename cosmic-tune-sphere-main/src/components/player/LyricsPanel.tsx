import { useState, useEffect, useCallback, useRef } from 'react';
import { Save, Copy, Trash2, Loader2, WandSparkles } from 'lucide-react';
import {
  getSavedLyrics,
  saveLyrics,
  clearSavedLyrics,
  resolveLyricsFromAudio,
} from '@/lib/lyrics';
import { getAudioBlob } from '@/lib/db';
import { toast } from 'sonner';

interface LyricsPanelProps {
  songTitle: string;
  songArtist: string;
  songId: string;
  isOpen: boolean;
}

export default function LyricsPanel({ songTitle, songArtist, songId, isOpen }: LyricsPanelProps) {
  const [lyrics, setLyrics] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const openAttemptRef = useRef<Set<string>>(new Set());

  const loadSavedLyrics = useCallback(() => {
    const saved = getSavedLyrics(songTitle, songArtist);
    setLyrics(saved || '');
    setError(false);
  }, [songArtist, songTitle]);

  const fetchLyricsForSong = useCallback(async () => {
    setLoading(true);
    setError(false);

    const result = await resolveLyricsFromAudio(songId, songTitle, songArtist, getAudioBlob);
    setLoading(false);

    if (result.lyrics) {
      setLyrics(result.lyrics);
      saveLyrics(songTitle, songArtist, result.lyrics);
      if (result.resolvedTrack.title !== songTitle || result.resolvedTrack.artist !== songArtist) {
        toast.success(`Lyrics matched as ${result.resolvedTrack.artist} — ${result.resolvedTrack.title}`);
      }
      return;
    }

    setError(true);
    if (!lyrics) {
      setLyrics('');
    }
    toast.error('Could not fetch lyrics for this song.');
  }, [lyrics, songArtist, songId, songTitle]);

  useEffect(() => {
    loadSavedLyrics();
  }, [songId, loadSavedLyrics]);

  useEffect(() => {
    if (!isOpen) return;
    const key = `${songId}:${songTitle}:${songArtist}`;
    if (openAttemptRef.current.has(key)) return;
    openAttemptRef.current.add(key);

    if (!getSavedLyrics(songTitle, songArtist)) {
      void fetchLyricsForSong();
    }
  }, [isOpen, songId, songTitle, songArtist, fetchLyricsForSong]);

  const handleSave = () => {
    saveLyrics(songTitle, songArtist, lyrics);
    toast.success('Lyrics saved');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(lyrics);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleClear = () => {
    if (!lyrics.trim()) return;
    if (confirm('Clear all lyrics?')) {
      setLyrics('');
      clearSavedLyrics(songTitle, songArtist);
      toast('Lyrics cleared');
    }
  };

  return (
    <div className="w-full h-full flex flex-col rounded-3xl overflow-hidden border border-border/30 shadow-2xl shadow-black/30"
      style={{ background: 'linear-gradient(145deg, #0a0a0a 0%, #141414 50%, #0d0d0d 100%)' }}
    >
      <div className="absolute inset-0 rounded-3xl opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'6\' height=\'6\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h1v1H0z\' fill=\'%23fff\' fill-opacity=\'.4\'/%3E%3C/svg%3E")', backgroundRepeat: 'repeat' }}
      />

      <div className="px-4 pt-3 pb-2 border-b border-white/5 flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.15em] text-white/40 font-medium">Lyrics</span>
        <span className="text-[10px] text-white/20 font-mono">AudD + LRCLIB</span>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {loading ? (
          <div className="flex items-center justify-center h-full gap-2 text-white/40 text-xs">
            <Loader2 className="w-5 h-5 animate-spin" />
            Fetching lyrics…
          </div>
        ) : (
          <textarea
            value={lyrics}
            onChange={e => setLyrics(e.target.value)}
            placeholder={error ? 'Could not fetch lyrics — you can write your own.' : 'Tap “Get Lyrics” or write your own here...'}
            className="w-full h-full resize-none bg-transparent text-white/80 text-sm leading-relaxed p-4 outline-none placeholder:text-white/20 placeholder:italic font-mono selection:bg-white/10 scrollbar-thin"
            style={{ fontFamily: "'Courier New', 'Fira Code', monospace", letterSpacing: '0.02em' }}
            spellCheck={false}
          />
        )}
      </div>

      <div className="flex items-center gap-2 px-4 py-3 border-t border-white/5 flex-wrap">
        <button
          onClick={() => void fetchLyricsForSong()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary-foreground text-xs transition-all active:scale-95 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <WandSparkles className="w-3.5 h-3.5" />} Get Lyrics
        </button>
        <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/90 text-xs transition-all active:scale-95">
          <Save className="w-3.5 h-3.5" /> Save
        </button>
        <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/90 text-xs transition-all active:scale-95">
          <Copy className="w-3.5 h-3.5" /> Copy
        </button>
        <button onClick={handleClear} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 text-xs transition-all active:scale-95 ml-auto">
          <Trash2 className="w-3.5 h-3.5" /> Clear
        </button>
      </div>
    </div>
  );
}
