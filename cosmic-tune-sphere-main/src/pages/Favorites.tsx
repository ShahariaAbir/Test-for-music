import { useState, useEffect, useCallback } from 'react';
import { getAllSongs, toggleFavorite, type Song } from '@/lib/db';
import { usePlayer } from '@/hooks/usePlayer';
import SongItem from '@/components/library/SongItem';
import { Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Favorites() {
  const [songs, setSongs] = useState<Song[]>([]);
  const { currentSong, play } = usePlayer();

  const load = useCallback(async () => {
    const all = await getAllSongs();
    setSongs(all.filter(s => s.isFavorite));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggleFav = async (id: string) => {
    await toggleFavorite(id);
    load();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-6 pb-3">
        <h1 className="text-2xl font-bold text-foreground">Favorites</h1>
        <p className="text-sm text-muted-foreground">{songs.length} song{songs.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Heart className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg font-medium">No favorites yet</p>
            <p className="text-sm">Tap the heart icon on a song to add it</p>
          </div>
        ) : (
          <div className="space-y-1">
            <AnimatePresence>
              {songs.map((song, i) => (
                <motion.div key={song.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                  <SongItem
                    song={song}
                    isActive={currentSong?.id === song.id}
                    onPlay={() => play(song, songs)}
                    onToggleFav={() => handleToggleFav(song.id)}
                    onRemove={() => {}}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
