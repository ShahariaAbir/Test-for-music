import { memo } from 'react';
import { Song } from '@/lib/db';
import { Music, Heart, MoreVertical, Trash2, Radio } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { usePlayer } from '@/hooks/usePlayer';


interface SongItemProps {
  song: Song;
  isActive: boolean;
  onPlay: () => void;
  onToggleFav: () => void;
  onRemove: () => void;
  onAddToPlaylist?: () => void;
  onShareNearby?: () => void;
}

function formatDuration(sec: number): string {
  if (!sec || !isFinite(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default memo(function SongItem({ song, isActive, onPlay, onToggleFav, onRemove, onAddToPlaylist, onShareNearby }: SongItemProps) {
  const { isPlaying } = usePlayer();
  const showBeat = isActive && isPlaying;

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer group active:scale-[0.98] transition-transform
        ${isActive
          ? 'bg-primary/10 border border-primary/20 shadow-md shadow-primary/5'
          : 'hover:bg-secondary/60 border border-transparent'
        }`}
      onClick={onPlay}
    >
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isActive
            ? 'bg-gradient-to-br from-primary/30 to-primary/10'
            : 'bg-secondary'
        }`}
      >
        {showBeat ? (
          <div className="flex items-end gap-[2px] h-4">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-[3px] bg-primary rounded-full animate-beat-bar"
                style={{ animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
        ) : isActive ? (
          <div className="flex items-end gap-[2px] h-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-[3px] bg-primary/50 rounded-full" style={{ height: `${6 + i * 3}px` }} />
            ))}
          </div>
        ) : (
          <Music className="w-5 h-5 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isActive ? 'text-primary' : 'text-foreground'}`}>{song.title}</p>
        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
      </div>

      <span className="text-xs text-muted-foreground font-mono flex-shrink-0">{formatDuration(song.duration)}</span>

      <button
        onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
        className="p-1.5 active:scale-90 transition-transform"
      >
        <Heart className={`w-4 h-4 transition-colors duration-200 ${
          song.isFavorite
            ? 'fill-primary text-primary'
            : 'text-muted-foreground hover:text-foreground'
        }`} />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <button className="p-1.5 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreVertical className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-card/95 backdrop-blur-xl border-border/50">
          {onAddToPlaylist && (
            <DropdownMenuItem onClick={onAddToPlaylist}>Add to Playlist</DropdownMenuItem>
          )}
          {onShareNearby && (
            <DropdownMenuItem onClick={onShareNearby}>
              <Radio className="w-4 h-4 mr-2" /> Share Nearby
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onRemove} className="text-destructive">
            <Trash2 className="w-4 h-4 mr-2" /> Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}, (prev, next) =>
  prev.song.id === next.song.id &&
  prev.song.isFavorite === next.song.isFavorite &&
  prev.song.title === next.song.title &&
  prev.isActive === next.isActive
);
