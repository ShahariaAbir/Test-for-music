import { useState, useEffect, useCallback } from 'react';
import { getAllPlaylists, createPlaylist, deletePlaylist, updatePlaylist, getAllSongs, type Playlist, type Song } from '@/lib/db';
import { usePlayer } from '@/hooks/usePlayer';
import SongItem from '@/components/library/SongItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, ListMusic, ArrowLeft, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function Playlists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [selected, setSelected] = useState<Playlist | null>(null);
  const [newName, setNewName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const { currentSong, play } = usePlayer();

  const load = useCallback(async () => {
    setPlaylists(await getAllPlaylists());
    setSongs(await getAllSongs());
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createPlaylist(newName.trim());
    setNewName('');
    setDialogOpen(false);
    load();
    toast.success('Playlist created');
  };

  const handleDelete = async (id: string) => {
    await deletePlaylist(id);
    if (selected?.id === id) setSelected(null);
    load();
    toast.success('Playlist deleted');
  };

  const playlistSongs = selected ? songs.filter(s => selected.songIds.includes(s.id)) : [];

  // Add song to selected playlist
  const handleAddSong = async (songId: string) => {
    if (!selected) return;
    if (selected.songIds.includes(songId)) {
      toast.info('Already in playlist');
      return;
    }
    const updated = { ...selected, songIds: [...selected.songIds, songId] };
    await updatePlaylist(updated);
    setSelected(updated);
    load();
    toast.success('Added to playlist');
  };

  const handleRemoveSong = async (songId: string) => {
    if (!selected) return;
    const updated = { ...selected, songIds: selected.songIds.filter(id => id !== songId) };
    await updatePlaylist(updated);
    setSelected(updated);
    load();
  };

  if (selected) {
    const availableSongs = songs.filter(s => !selected.songIds.includes(s.id));
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 pt-6 pb-3 flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="p-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{selected.name}</h1>
            <p className="text-sm text-muted-foreground">{playlistSongs.length} songs</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {playlistSongs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <p className="text-sm">No songs in this playlist</p>
            </div>
          ) : (
            <div className="space-y-1 mb-4">
              {playlistSongs.map(song => (
                <SongItem
                  key={song.id}
                  song={song}
                  isActive={currentSong?.id === song.id}
                  onPlay={() => play(song, playlistSongs)}
                  onToggleFav={() => {}}
                  onRemove={() => handleRemoveSong(song.id)}
                />
              ))}
            </div>
          )}

          {availableSongs.length > 0 && (
            <>
              <p className="text-xs uppercase tracking-wider text-muted-foreground px-4 py-2">Add songs</p>
              <div className="space-y-1">
                {availableSongs.map(song => (
                  <div
                    key={song.id}
                    onClick={() => handleAddSong(song.id)}
                    className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-secondary/50 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate text-foreground">{song.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-6 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Playlists</h1>
          <p className="text-sm text-muted-foreground">{playlists.length} playlist{playlists.length !== 1 ? 's' : ''}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" /> New
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Create Playlist</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Playlist name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="bg-secondary border-none"
            />
            <Button onClick={handleCreate} disabled={!newName.trim()}>Create</Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {playlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <ListMusic className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg font-medium">No playlists yet</p>
            <p className="text-sm">Tap "New" to create one</p>
          </div>
        ) : (
          <div className="space-y-1">
            <AnimatePresence>
              {playlists.map((pl, i) => (
                <motion.div
                  key={pl.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-secondary/50 cursor-pointer group"
                  onClick={() => setSelected(pl)}
                >
                  <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center">
                    <ListMusic className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-foreground">{pl.name}</p>
                    <p className="text-xs text-muted-foreground">{pl.songIds.length} songs</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(pl.id); }}
                    className="p-1.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
