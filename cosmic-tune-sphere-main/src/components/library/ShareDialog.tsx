import { useState, useCallback, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wifi, WifiOff, Download, Loader2, Music, Radio, RefreshCw, Disc3, Signal } from 'lucide-react';
import { SharingService, SharedSong, SharingState, PlaybackSyncState } from '@/lib/sharing';
import { getAllSongs, getAudioBlob, type Song } from '@/lib/db';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePlayer } from '@/hooks/usePlayer';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  song?: Song; // If provided, share specific song; otherwise share all
}

export default function ShareDialog({ open, onOpenChange, song }: ShareDialogProps) {
  const [mode, setMode] = useState<'menu' | 'host' | 'join' | 'sync-host' | 'sync-join'>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [isConnectedToHost, setIsConnectedToHost] = useState(false);
  const [peerName] = useState(() => `User-${Math.random().toString(36).substr(2, 4).toUpperCase()}`);
  const [state, setState] = useState<SharingState>({
    peerId: null,
    isScanning: false,
    availableSongs: [],
    connectedPeers: [],
    isSharing: false,
  });
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [hostSongs, setHostSongs] = useState<Song[]>([]);
  const [songSearch, setSongSearch] = useState('');
  const [syncStatus, setSyncStatus] = useState('Waiting for host...');
  const serviceRef = useRef<SharingService | null>(null);
  const isApplyingRemoteSync = useRef(false);
  const lastSyncSentAt = useRef(0);
  const pendingSyncRef = useRef<PlaybackSyncState | null>(null);
  const requestedSyncSongRef = useRef<string | null>(null);
  const broadcastIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { currentSong, currentTime, isPlaying, play, seek, setPlaybackState } = usePlayer();
  const getSharedSongKey = useCallback((shared: SharedSong) => `${shared.peerId}:${shared.song.id}`, []);

  const updateState = useCallback((partial: Partial<SharingState>) => {
    setState(s => ({ ...s, ...partial }));
  }, []);

  useEffect(() => {
    return () => {
      serviceRef.current?.disconnect();
      if (broadcastIntervalRef.current) {
        clearInterval(broadcastIntervalRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    serviceRef.current?.disconnect();
    serviceRef.current = null;
    if (broadcastIntervalRef.current) {
      clearInterval(broadcastIntervalRef.current);
      broadcastIntervalRef.current = null;
    }
    setState({
      peerId: null, isScanning: false, availableSongs: [],
      connectedPeers: [], isSharing: false,
    });
    setMode('menu');
    setRoomCode('');
    setIsConnectedToHost(false);
    setHostSongs([]);
    setSongSearch('');
    pendingSyncRef.current = null;
    requestedSyncSongRef.current = null;
    isApplyingRemoteSync.current = false;
    onOpenChange(false);
  };

  const applyRemoteSync = useCallback(async (sync: PlaybackSyncState) => {
    // Prevent handling our own broadcasts (120ms debounce)
    if (Date.now() < lastSyncSentAt.current + 120) return;
    
    // Prevent re-entrant calls
    if (isApplyingRemoteSync.current) return;
    
    pendingSyncRef.current = sync;
    
    const songToPlay = state.availableSongs.find((s) => s.song.id === sync.songId)?.song;
    if (!songToPlay) {
      // Song not available yet, request it from any peer that has it
      const remote = state.availableSongs.find((s) => s.song.id === sync.songId);
      if (remote && requestedSyncSongRef.current !== sync.songId) {
        requestedSyncSongRef.current = sync.songId;
        serviceRef.current?.requestSong(remote.peerId, sync.songId);
        setSyncStatus('Downloading song from host...');
      }
      return;
    }

    const localBlob = await getAudioBlob(songToPlay.id);
    if (!localBlob) {
      // Need to download first
      if (requestedSyncSongRef.current !== sync.songId) {
        requestedSyncSongRef.current = sync.songId;
        const remotePeer = state.availableSongs.find(s => s.song.id === sync.songId);
        if (remotePeer) {
          serviceRef.current?.requestSong(remotePeer.peerId, sync.songId);
          setSyncStatus('Downloading song from host...');
        }
      }
      return;
    }

    // We have the song locally, apply sync
    isApplyingRemoteSync.current = true;
    requestedSyncSongRef.current = null;
    
    // Calculate target time with network latency compensation
    const latencyMs = Date.now() - (sync.sentAt || Date.now());
    const driftSeconds = latencyMs / 1000;
    const targetTime = Math.max(0, sync.currentTime + driftSeconds);

    const applyPlayback = () => {
      if (!currentSong || currentSong.id !== sync.songId) {
        // Switch to new song
        play(songToPlay, [songToPlay]);
      }
      
      // Use setTimeout to ensure play() has started
      setTimeout(() => {
        seek(targetTime);
        setPlaybackState(sync.isPlaying);
        setSyncStatus(`Synced: ${sync.isPlaying ? 'Playing' : 'Paused'} at ${targetTime.toFixed(1)}s`);
        isApplyingRemoteSync.current = false;
        pendingSyncRef.current = null;
      }, 50);
    };

    applyPlayback();
  }, [currentSong, play, seek, setPlaybackState, state.availableSongs]);

  const createService = useCallback(() => {
    const service = new SharingService(peerName, updateState, {
      onSongReceived: (incomingSong) => {
        // Clear from downloading set
        setDownloading(s => {
          const next = new Set(s);
          Array.from(next).forEach((entry) => {
            if (entry.endsWith(`:${incomingSong.id}`)) next.delete(entry);
          });
          return next;
        });
        
        toast.success(`Downloaded: ${incomingSong.title}`);
        
        // Update available songs immediately so applyRemoteSync can find it
        setState(prev => {
          // Avoid duplicates
          const exists = prev.availableSongs.some(s => s.song.id === incomingSong.id);
          if (exists) return prev;
          return {
            ...prev,
            availableSongs: [...prev.availableSongs, { 
              peerId: serviceRef.current?.peerId || 'unknown', 
              song: incomingSong 
            }]
          };
        });
        
        // Check if this was the pending sync song
        if (pendingSyncRef.current?.songId === incomingSong.id && mode === 'sync-join') {
          setTimeout(() => {
            if (pendingSyncRef.current && !isApplyingRemoteSync.current) {
              void applyRemoteSync(pendingSyncRef.current);
            }
          }, 100);
        }
      },
      onPlaybackSync: async (sync) => {
        // Only apply sync in sync-join mode
        if (mode !== 'sync-join') return;
        
        // Store sync for later application if needed
        pendingSyncRef.current = sync;
        
        // Try to apply immediately if possible
        await applyRemoteSync(sync);
      },
    });
    serviceRef.current = service;
    return service;
  }, [applyRemoteSync, mode, peerName, updateState]);

  const startHosting = async (): Promise<boolean> => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setRoomCode(code);
    const service = createService();

    try {
      const songs = song ? [song] : await getAllSongs();
      setHostSongs(songs);
      await service.startSharing(songs, code);
      setMode('host');
      toast.success('Sharing started! Share the room code with others.');
      return true;
    } catch {
      toast.error('Failed to start sharing');
      return false;
    }
  };

  const joinRoom = async (): Promise<boolean> => {
    const normalizedCode = roomCode.replace(/\D/g, '').slice(0, 4);
    if (!/^\d{4}$/.test(normalizedCode)) {
      toast.error('Please enter a 4-digit room code.');
      return false;
    }

    const service = createService();

    try {
      await service.scanForPeers(normalizedCode);
      setMode('join');
      setIsConnectedToHost(true);
      toast.success('Connected. Waiting for shared songs...');
      return true;
    } catch {
      setIsConnectedToHost(false);
      toast.error('Could not connect. Check code and network, then retry.');
      return false;
    }
  };

  const startSyncHosting = async () => {
    const ok = await startHosting();
    if (!ok) return;
    setMode('sync-host');
    setSyncStatus('Live sync is active');
  };

  const joinSyncHost = async () => {
    const ok = await joinRoom();
    if (!ok) return;
    setMode('sync-join');
    setSyncStatus('Connected. Waiting for playback sync...');
  };

  // Broadcast sync state when hosting
  useEffect(() => {
    if (mode !== 'sync-host' || !serviceRef.current || !currentSong) {
      // Clean up interval if not in sync-host mode
      if (broadcastIntervalRef.current) {
        clearInterval(broadcastIntervalRef.current);
        broadcastIntervalRef.current = null;
      }
      return;
    }
    
    // Clear any existing interval
    if (broadcastIntervalRef.current) {
      clearInterval(broadcastIntervalRef.current);
    }
    
    // Broadcast function
    const broadcast = () => {
      if (isApplyingRemoteSync.current) return; // Don't broadcast while applying remote changes
      
      lastSyncSentAt.current = Date.now();
      serviceRef.current?.broadcastSyncState({
        songId: currentSong.id,
        currentTime,
        isPlaying,
        sentAt: Date.now(),
      });
    };
    
    // Immediate broadcast on change
    broadcast();
    
    // Continue broadcasting every 500ms while playing to keep peers in sync
    broadcastIntervalRef.current = setInterval(() => {
      if (isPlaying) broadcast();
    }, 500);
    
    return () => {
      if (broadcastIntervalRef.current) {
        clearInterval(broadcastIntervalRef.current);
        broadcastIntervalRef.current = null;
      }
    };
  }, [mode, currentSong, currentTime, isPlaying]);

  // Apply remote sync when joining
  useEffect(() => {
    if (mode !== 'sync-join' || !pendingSyncRef.current) return;
    
    // Try to apply if we have songs available and not currently applying
    if (!isApplyingRemoteSync.current && state.availableSongs.length > 0) {
      void applyRemoteSync(pendingSyncRef.current);
    }
  }, [mode, state.availableSongs, applyRemoteSync]);

  const downloadSong = async (shared: SharedSong) => {
    if (!serviceRef.current) return;
    setDownloading(s => new Set(s).add(getSharedSongKey(shared)));
    serviceRef.current.requestSong(shared.peerId, shared.song.id);
  };

  const filteredHostSongs = hostSongs.filter((candidate) => {
    const q = songSearch.trim().toLowerCase();
    if (!q) return true;
    return `${candidate.title} ${candidate.artist} ${candidate.album ?? ''}`.toLowerCase().includes(q);
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card/95 backdrop-blur-xl border-border/50 w-[96vw] max-w-md max-h-[88dvh] overflow-hidden p-0">
        <DialogHeader className="px-4 pt-5 sm:px-6 sm:pt-6">
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Radio className="w-5 h-5 text-primary" />
            Nearby Share
          </DialogTitle>
        </DialogHeader>

        {mode === 'menu' && (
          <div className="space-y-3 py-2 px-4 pb-5 sm:px-6 sm:pb-6">
            <p className="text-sm text-muted-foreground">Share music with nearby devices on the same network.</p>
            <Button onClick={startHosting} className="w-full gap-2" variant="default">
              <Wifi className="w-4 h-4" />
              {song ? `Share "${song.title}"` : 'Share My Library'}
            </Button>
            <Button onClick={() => setMode('join')} className="w-full gap-2" variant="secondary">
              <Download className="w-4 h-4" />
              Receive Music
            </Button>
            <Button onClick={startSyncHosting} className="w-full gap-2" variant="outline">
              <Wifi className="w-4 h-4" />
              Host Live Session
            </Button>
            <Button onClick={() => setMode('sync-join')} className="w-full gap-2" variant="outline">
              <Wifi className="w-4 h-4" />
              Join Live Session
            </Button>
          </div>
        )}

        {mode === 'host' && (
          <div className="space-y-4 py-2 px-4 pb-5 sm:px-6 sm:pb-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Room Code</p>
              <div className="text-3xl font-bold font-mono tracking-[0.3em] text-primary">{roomCode}</div>
              <p className="text-xs text-muted-foreground mt-2">Share this code with nearby users</p>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-foreground">Broadcasting...</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {state.connectedPeers.length} connected
              </span>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Shared Songs</label>
              <Input
                value={songSearch}
                onChange={(e) => setSongSearch(e.target.value)}
                placeholder="Search songs..."
              />
              <ScrollArea className="h-[22dvh] rounded-lg border border-border/60 bg-secondary/20 px-2">
                <div className="space-y-1 py-2">
                  {filteredHostSongs.map((sharedSong) => (
                    <div key={sharedSong.id} className="rounded-md px-2 py-1.5">
                      <p className="text-sm text-foreground truncate">{sharedSong.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{sharedSong.artist}</p>
                    </div>
                  ))}
                  {filteredHostSongs.length === 0 && (
                    <p className="text-xs text-muted-foreground px-2 py-4 text-center">No songs match your search.</p>
                  )}
                </div>
              </ScrollArea>
            </div>

            <Button onClick={handleClose} variant="outline" className="w-full gap-2">
              <WifiOff className="w-4 h-4" /> Stop Sharing
            </Button>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-4 py-2 px-4 pb-5 min-h-0 sm:px-6 sm:pb-6">
            {!isConnectedToHost ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Enter Room Code</label>
                  <Input
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="1234"
                    className="text-center font-mono text-lg tracking-[0.2em] uppercase"
                    maxLength={4}
                    inputMode="numeric"
                  />
                </div>
                <Button onClick={joinRoom} className="w-full gap-2" disabled={state.isScanning || !/^\d{4}$/.test(roomCode)}>
                  {state.isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                  Connect
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Keep this screen open while scanning nearby hosts on your network.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm text-foreground">Connected</span>
                  <span className="ml-auto text-xs text-muted-foreground">{state.availableSongs.length} songs</span>
                </div>

                {state.availableSongs.length > 0 ? (
                  <ScrollArea className="h-[50dvh] -mx-1 px-1">
                    <div className="space-y-2">
                      {state.availableSongs.map(shared => (
                        <div
                          key={getSharedSongKey(shared)}
                          className="flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5"
                        >
                          <Music className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm leading-tight text-foreground break-words">{shared.song.title}</p>
                            <p className="text-xs text-muted-foreground truncate mt-1">{shared.song.artist}</p>
                          </div>
                          <button
                            onClick={() => downloadSong(shared)}
                            disabled={downloading.has(getSharedSongKey(shared))}
                            className="h-10 w-10 flex items-center justify-center rounded-full bg-background/70 border border-border/60 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            aria-label={`Download ${shared.song.title}`}
                          >
                            {downloading.has(getSharedSongKey(shared)) ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    <p className="text-sm">Waiting for songs...</p>
                  </div>
                )}

                <Button onClick={handleClose} variant="outline" className="w-full gap-2">
                  <WifiOff className="w-4 h-4" /> Disconnect
                </Button>
                <Button
                  onClick={joinRoom}
                  variant="ghost"
                  className="w-full gap-2"
                  disabled={state.isScanning}
                >
                  {state.isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Rescan Host
                </Button>
              </>
            )}
          </div>
        )}

        {(mode === 'sync-join' || mode === 'sync-host') && (
          <div className="space-y-4 py-2 px-4 pb-5 min-h-0 sm:px-6 sm:pb-6">
            {mode === 'sync-join' && !isConnectedToHost ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Enter Host Code</label>
                  <Input
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="1234"
                    className="text-center font-mono text-lg tracking-[0.2em] uppercase"
                    maxLength={4}
                    inputMode="numeric"
                  />
                </div>
                <Button onClick={joinSyncHost} className="w-full gap-2" disabled={state.isScanning || !/^\d{4}$/.test(roomCode)}>
                  {state.isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                  Join Host
                </Button>
              </>
            ) : (
              <>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Session Code</p>
                  <div className="text-3xl font-bold font-mono tracking-[0.3em] text-primary">{roomCode || '----'}</div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm text-foreground">{syncStatus}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{state.connectedPeers.length} peers</span>
                </div>
                <div className="rounded-lg border border-border/60 bg-secondary/20 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Signal className="w-3.5 h-3.5" />
                    <span>Active RTC sync running every 500ms during playback.</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Disc3 className="w-3.5 h-3.5" />
                    <span>
                      {mode === 'sync-host'
                        ? 'Start a song and all connected devices auto-align in real time.'
                        : 'When host starts music, your player seeks and play/pause are corrected automatically.'}
                    </span>
                  </div>
                </div>
                {mode === 'sync-host' && (
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Pick and play a song for everyone</label>
                    <Input
                      value={songSearch}
                      onChange={(e) => setSongSearch(e.target.value)}
                      placeholder="Search songs..."
                    />
                    <ScrollArea className="h-[24dvh] rounded-lg border border-border/60 bg-secondary/20 px-2">
                      <div className="space-y-1 py-2">
                        {filteredHostSongs.map((hostSong) => (
                          <button
                            key={hostSong.id}
                            className="w-full text-left rounded-md border border-transparent hover:border-border/60 hover:bg-background/70 px-2 py-1.5 transition-colors"
                            onClick={() => play(hostSong, hostSongs)}
                          >
                            <p className="text-sm text-foreground truncate">{hostSong.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{hostSong.artist}</p>
                          </button>
                        ))}
                        {filteredHostSongs.length === 0 && (
                          <p className="text-xs text-muted-foreground px-2 py-4 text-center">No songs match your search.</p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Host controls play/pause and progress; joined devices auto-correct playback to stay aligned.
                </p>
                <Button onClick={handleClose} variant="outline" className="w-full gap-2">
                  <WifiOff className="w-4 h-4" />
                  {mode === 'sync-host' ? 'End Session' : 'Leave Session'}
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
