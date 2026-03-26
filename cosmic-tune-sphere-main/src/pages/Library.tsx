import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAllSongs, removeSong, toggleFavorite, type Song } from '@/lib/db';
import { usePlayer } from '@/hooks/usePlayer';
import SongItem from '@/components/library/SongItem';
import ImportButton from '@/components/library/ImportButton';
import ShareDialog from '@/components/library/ShareDialog';
import { Input } from '@/components/ui/input';
import { Search, Music2, ArrowUpDown, Radio } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

type SortMode = 'title' | 'artist' | 'recent';

export default function Library() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('recent');
  const [isLoading, setIsLoading] = useState(false);
  const [showFirstStart, setShowFirstStart] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareSong, setShareSong] = useState<Song | undefined>(undefined);
  const { currentSong, play } = usePlayer();

  useEffect(() => {
    const hasLaunched = localStorage.getItem('sonicwave_launched');
    if (!hasLaunched) {
      localStorage.setItem('sonicwave_launched', '1');
      if (!navigator.onLine) {
        setShowFirstStart(true);
      }
    }
  }, []);

  const loadSongs = useCallback(async () => {
    try {
      setIsLoading(true);
      const all = await getAllSongs();
      setSongs(all);
    } catch (error) {
      console.error('Error loading songs:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { 
    loadSongs(); 
  }, [loadSongs]);

  const filtered = useMemo(() =>
    songs
      .filter(s => {
        const q = search.toLowerCase();
        return !q || s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || s.album.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (sort === 'title') return a.title.localeCompare(b.title);
        if (sort === 'artist') return a.artist.localeCompare(b.artist);
        return b.addedAt - a.addedAt;
      }),
    [songs, search, sort]
  );

  // Optimistic toggle: update local state immediately, no full reload
  const handleToggleFav = useCallback(async (id: string) => {
    setSongs(prev => prev.map(s => s.id === id ? { ...s, isFavorite: !s.isFavorite } : s));
    await toggleFavorite(id);
  }, []);

  const handleRemove = useCallback(async (id: string) => {
    setSongs(prev => prev.filter(s => s.id !== id));
    await removeSong(id);
  }, []);

  const handlePlay = useCallback((song: Song) => {
    play(song, filtered);
  }, [play, filtered]);

  const hasSongs = songs.length > 0;

  return (
    <div className="flex flex-col h-full">
      <Dialog open={showFirstStart} onOpenChange={setShowFirstStart}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Welcome to SonicWave!</DialogTitle>
            <DialogDescription>
              For the best first-time experience, please turn on WiFi or mobile data to load all app resources. After that, the app works fully offline!
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setShowFirstStart(false)} className="w-full">Got it</Button>
        </DialogContent>
      </Dialog>

      <div className="px-4 pt-6 pb-3">
        <h1 className="text-2xl font-bold text-foreground">Library</h1>
        <p className="text-sm text-muted-foreground">
          {isLoading ? 'Loading...' : `${songs.length} song${songs.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      <div className="px-4 pb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search songs…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-none"
            disabled={isLoading}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" disabled={isLoading}>
              <ArrowUpDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card border-border">
            <DropdownMenuItem onClick={() => setSort('recent')} className={sort === 'recent' ? 'text-primary' : ''}>
              Recently Added
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSort('title')} className={sort === 'title' ? 'text-primary' : ''}>
              By Title
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSort('artist')} className={sort === 'artist' ? 'text-primary' : ''}>
              By Artist
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ImportButton onImported={loadSongs} blink={!hasSongs && !isLoading} />
        <Button variant="secondary" size="icon" onClick={() => { setShareSong(undefined); setShareDialogOpen(true); }} title="Share Nearby">
          <Radio className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-lg font-medium">Loading your music...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Music2 className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg font-medium">{!hasSongs ? 'No music yet' : 'No results'}</p>
            <p className="text-sm">{!hasSongs ? 'Tap the blinking button to import songs' : 'Try a different search'}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((song) => (
              <SongItem
                key={song.id}
                song={song}
                isActive={currentSong?.id === song.id}
                onPlay={() => handlePlay(song)}
                onToggleFav={() => handleToggleFav(song.id)}
                onRemove={() => handleRemove(song.id)}
                onShareNearby={() => { setShareSong(song); setShareDialogOpen(true); }}
              />
            ))}
          </div>
        )}
      </div>
      <ShareDialog open={shareDialogOpen} onOpenChange={setShareDialogOpen} song={shareSong} />
    </div>
  );
}
