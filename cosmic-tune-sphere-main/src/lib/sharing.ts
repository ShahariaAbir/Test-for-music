import Peer, { DataConnection } from 'peerjs';
import { Song, getAudioBlob, importSongs } from '@/lib/db';

export interface SharedSong {
  song: Song;
  peerId: string;
  peerName: string;
}

export interface SharingState {
  peerId: string | null;
  isScanning: boolean;
  availableSongs: SharedSong[];
  connectedPeers: string[];
  isSharing: boolean;
}

export interface PlaybackSyncState {
  songId: string;
  currentTime: number;
  isPlaying: boolean;
  sentAt: number;
}

type MessageType =
  | { type: 'song-list'; songs: Song[]; peerName: string }
  | { type: 'request-song'; songId: string }
  | { type: 'song-data-start'; song: Song; totalChunks: number; mimeType: string }
  | { type: 'song-data-chunk'; songId: string; chunkIndex: number; chunk: ArrayBuffer }
  | { type: 'song-data-end'; songId: string }
  | { type: 'discover' }
  | { type: 'sync-state'; state: PlaybackSyncState };

const ROOM_PREFIX = 'nova-share-';
const HOST_SUFFIX = 'host';
const SONG_CHUNK_SIZE = 64 * 1024;

type IncomingSongTransfer = {
  song: Song;
  totalChunks: number;
  mimeType: string;
  chunks: ArrayBuffer[];
};

function getHostPeerId(roomCode: string): string {
  return `${ROOM_PREFIX}${roomCode}-${HOST_SUFFIX}`;
}

export class SharingService {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private onStateChange: (state: Partial<SharingState>) => void;
  private sharedSongs: Song[] = [];
  private discoveredSongs: SharedSong[] = [];
  private peerName: string;
  private roomCode: string = '';
  private onSongReceived?: (song: Song) => void;
  private onPlaybackSync?: (state: PlaybackSyncState) => void;
  private incomingSongTransfers: Map<string, IncomingSongTransfer> = new Map();
  private isHost: boolean = false;

  constructor(
    peerName: string,
    onStateChange: (state: Partial<SharingState>) => void,
    options?: {
      onSongReceived?: (song: Song) => void;
      onPlaybackSync?: (state: PlaybackSyncState) => void;
    }
  ) {
    this.peerName = peerName;
    this.onStateChange = onStateChange;
    this.onSongReceived = options?.onSongReceived;
    this.onPlaybackSync = options?.onPlaybackSync;
  }

  async startSharing(songs: Song[], roomCode: string): Promise<string> {
    this.sharedSongs = songs;
    this.roomCode = roomCode.toUpperCase();
    this.isHost = true;

    return new Promise((resolve, reject) => {
      const peerId = getHostPeerId(this.roomCode);
      this.peer = new Peer(peerId);

      this.peer.on('open', (id) => {
        this.onStateChange({ peerId: id, isSharing: true });
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.handleConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        // Don't reject on existing ID error, just resolve with existing
        if (err.type === 'unavailable-id') {
          this.onStateChange({ peerId: peerId, isSharing: true });
          resolve(peerId);
        } else {
          reject(err);
        }
      });
    });
  }

  async scanForPeers(roomCode: string): Promise<void> {
    this.roomCode = roomCode.toUpperCase();
    this.isHost = false;
    this.onStateChange({ isScanning: true });

    if (!this.peer) {
      const peerId = `${ROOM_PREFIX}${this.roomCode}-${Math.random().toString(36).slice(2, 8)}`;
      this.peer = new Peer(peerId);
      await new Promise<void>((resolve, reject) => {
        this.peer!.on('open', () => resolve());
        this.peer!.on('error', (err) => reject(err));
      });
      this.peer.on('connection', (conn) => this.handleConnection(conn));
    }

    await new Promise<void>((resolve, reject) => {
      const hostPeerId = getHostPeerId(this.roomCode);
      const conn = this.peer!.connect(hostPeerId, { reliable: true });
      
      const timer = window.setTimeout(() => {
        reject(new Error('Connection timed out'));
      }, 8000);

      conn.on('open', () => {
        window.clearTimeout(timer);
        this.handleConnection(conn);
        resolve();
      });

      conn.on('error', (err) => {
        window.clearTimeout(timer);
        reject(err);
      });
    }).finally(() => {
      this.onStateChange({ isScanning: false });
    });
  }

  connectToPeer(targetPeerId: string): void {
    if (!this.peer || this.connections.has(targetPeerId)) return;
    const conn = this.peer.connect(targetPeerId, { reliable: true });
    this.handleConnection(conn);
  }

  private handleConnection(conn: DataConnection) {
    conn.on('open', () => {
      // Only add to connections if not already present
      if (!this.connections.has(conn.peer)) {
        this.connections.set(conn.peer, conn);
        this.onStateChange({
          connectedPeers: Array.from(this.connections.keys()),
        });

        // Send our song list if we have songs to share
        if (this.sharedSongs.length > 0) {
          conn.send({
            type: 'song-list',
            songs: this.sharedSongs,
            peerName: this.peerName,
          } as MessageType);
        }

        // Ask for their songs
        conn.send({ type: 'discover' } as MessageType);
      }
    });

    conn.on('data', async (data) => {
      const msg = data as MessageType;

      switch (msg.type) {
        case 'song-list':
          const newSongs: SharedSong[] = msg.songs.map((s) => ({
            song: s,
            peerId: conn.peer,
            peerName: msg.peerName,
          }));
          this.onStateChange({
            availableSongs: this.mergeSharedSongs(newSongs),
          });
          break;

        case 'discover':
          if (this.sharedSongs.length > 0) {
            conn.send({
              type: 'song-list',
              songs: this.sharedSongs,
              peerName: this.peerName,
            } as MessageType);
          }
          break;

        case 'request-song':
          const blob = await getAudioBlob(msg.songId);
          const song = this.sharedSongs.find(s => s.id === msg.songId);
          if (blob && song) {
            await this.sendSongInChunks(conn, song, blob);
          }
          break;

        case 'song-data-start':
          this.incomingSongTransfers.set(msg.song.id, {
            song: msg.song,
            totalChunks: msg.totalChunks,
            mimeType: msg.mimeType,
            chunks: new Array(msg.totalChunks),
          });
          break;

        case 'song-data-chunk':
          const transfer = this.incomingSongTransfers.get(msg.songId);
          if (!transfer) break;
          if (msg.chunkIndex < 0 || msg.chunkIndex >= transfer.totalChunks) break;
          transfer.chunks[msg.chunkIndex] = msg.chunk;
          break;

        case 'song-data-end':
          await this.completeSongTransfer(msg.songId);
          break;

        case 'sync-state':
          // Only process sync if we're not the host (clients follow host)
          if (!this.isHost && this.onPlaybackSync) {
            this.onPlaybackSync(msg.state);
          }
          break;
      }
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.onStateChange({
        connectedPeers: Array.from(this.connections.keys()),
      });
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      this.connections.delete(conn.peer);
      this.onStateChange({
        connectedPeers: Array.from(this.connections.keys()),
      });
    });
  }

  private async sendSongInChunks(conn: DataConnection, song: Song, blob: Blob): Promise<void> {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const totalChunks = Math.ceil(bytes.length / SONG_CHUNK_SIZE);

    conn.send({
      type: 'song-data-start',
      song,
      totalChunks,
      mimeType: blob.type || 'audio/mpeg',
    } as MessageType);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * SONG_CHUNK_SIZE;
      const end = Math.min(start + SONG_CHUNK_SIZE, bytes.length);
      const chunk = bytes.slice(start, end).buffer;
      conn.send({
        type: 'song-data-chunk',
        songId: song.id,
        chunkIndex: i,
        chunk,
      } as MessageType);
    }

    conn.send({
      type: 'song-data-end',
      songId: song.id,
    } as MessageType);
  }

  private async completeSongTransfer(songId: string): Promise<void> {
    const transfer = this.incomingSongTransfers.get(songId);
    if (!transfer) return;

    const hasAllChunks = transfer.chunks.every(Boolean);
    if (!hasAllChunks) {
      console.warn(`Incomplete song transfer for ${songId}`);
      this.incomingSongTransfers.delete(songId);
      return;
    }

    const importBlob = new Blob(transfer.chunks, { type: transfer.mimeType });
    const blobMap = new Map<string, Blob>();
    blobMap.set(songId, importBlob);
    await importSongs([{ ...transfer.song, addedAt: Date.now() }], blobMap);
    this.incomingSongTransfers.delete(songId);
    this.onSongReceived?.(transfer.song);
  }

  private mergeSharedSongs(nextSongs: SharedSong[]): SharedSong[] {
    const merged = new Map<string, SharedSong>();
    for (const song of this.discoveredSongs) {
      merged.set(`${song.peerId}:${song.song.id}`, song);
    }
    for (const song of nextSongs) {
      merged.set(`${song.peerId}:${song.song.id}`, song);
    }
    this.discoveredSongs = Array.from(merged.values());
    return this.discoveredSongs;
  }

  requestSong(peerId: string, songId: string): void {
    const conn = this.connections.get(peerId);
    if (conn && conn.open) {
      conn.send({ type: 'request-song', songId } as MessageType);
    } else {
      console.warn(`No open connection to peer ${peerId}`);
    }
  }

  broadcastSyncState(state: Omit<PlaybackSyncState, 'sentAt'>): void {
    // Only hosts should broadcast sync state
    if (!this.isHost) return;
    
    const payload: MessageType = {
      type: 'sync-state',
      state: { ...state, sentAt: Date.now() },
    };
    
    let sentCount = 0;
    this.connections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(payload);
          sentCount++;
        } catch (err) {
          console.error('Failed to send sync to peer:', err);
        }
      }
    });
    
    if (sentCount === 0) {
      console.warn('No open connections to broadcast sync state');
    }
  }

  disconnect(): void {
    this.connections.forEach(conn => conn.close());
    this.connections.clear();
    this.discoveredSongs = [];
    this.incomingSongTransfers.clear();
    this.isHost = false;
    this.peer?.destroy();
    this.peer = null;
    this.onStateChange({
      peerId: null,
      isSharing: false,
      isScanning: false,
      availableSongs: [],
      connectedPeers: [],
    });
  }

  get isConnected(): boolean {
    return this.peer !== null && !this.peer.disconnected;
  }

  get peerId(): string | null {
    return this.peer?.id || null;
  }
}
