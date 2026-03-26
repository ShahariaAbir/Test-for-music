import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  fingerprint?: string;
  importSignature?: string;
  url: string;
  coverUrl: string;
  isFavorite: boolean;
  addedAt: number;
}

export interface Playlist {
  id: string;
  name: string;
  songIds: string[];
  createdAt: number;
}

interface NovaDB extends DBSchema {
  songs: { key: string; value: Song };
  audioBlobs: { key: string; value: { id: string; blob: Blob } };
  playlists: { key: string; value: Playlist };
  songBackgrounds: { key: string; value: { id: string; dataUrl: string } };
}

let dbPromise: Promise<IDBPDatabase<NovaDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<NovaDB>('novaplayer', 3, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('songs')) {
          db.createObjectStore('songs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('audioBlobs')) {
          db.createObjectStore('audioBlobs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('playlists')) {
          db.createObjectStore('playlists', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('songBackgrounds')) {
          db.createObjectStore('songBackgrounds', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// Songs
export const getAllSongs = async (): Promise<Song[]> => {
  const db = await getDB();
  return db.getAll('songs');
};

export const getSongById = async (id: string): Promise<Song | undefined> => {
  const db = await getDB();
  return db.get('songs', id);
};

export const importSongs = async (newSongs: Song[], blobs?: Map<string, Blob>): Promise<void> => {
  if (newSongs.length === 0) return;
  const db = await getDB();
  const tx = db.transaction(['songs', 'audioBlobs'], 'readwrite');
  const songStore = tx.objectStore('songs');
  const blobStore = tx.objectStore('audioBlobs');

  for (const song of newSongs) {
    await songStore.put(song);
    const blob = blobs?.get(song.id);
    if (blob) {
      await blobStore.put({ id: song.id, blob });
    }
  }

  await tx.done;
};

export const removeSong = async (id: string): Promise<void> => {
  const db = await getDB();
  const tx = db.transaction(['songs', 'audioBlobs', 'songBackgrounds'], 'readwrite');
  await tx.objectStore('songs').delete(id);
  await tx.objectStore('audioBlobs').delete(id);
  await tx.objectStore('songBackgrounds').delete(id);
  await tx.done;
};

export const toggleFavorite = async (id: string): Promise<void> => {
  const db = await getDB();
  const song = await db.get('songs', id);
  if (song) {
    song.isFavorite = !song.isFavorite;
    await db.put('songs', song);
  }
};

export const updateSong = async (id: string, updates: Partial<Song>): Promise<void> => {
  const db = await getDB();
  const song = await db.get('songs', id);
  if (song) {
    await db.put('songs', { ...song, ...updates });
  }
};

export const clearAllSongs = async (): Promise<void> => {
  const db = await getDB();
  const tx = db.transaction(['songs', 'audioBlobs', 'songBackgrounds'], 'readwrite');
  await tx.objectStore('songs').clear();
  await tx.objectStore('audioBlobs').clear();
  await tx.objectStore('songBackgrounds').clear();
  await tx.done;
};

export const getAudioBlob = async (id: string): Promise<Blob | undefined> => {
  const db = await getDB();
  const entry = await db.get('audioBlobs', id);
  return entry?.blob;
};

// Song Backgrounds
export const getSongBackground = async (songId: string): Promise<string | null> => {
  const db = await getDB();
  const entry = await db.get('songBackgrounds', songId);
  return entry?.dataUrl ?? null;
};

export const setSongBackground = async (songId: string, dataUrl: string): Promise<void> => {
  const db = await getDB();
  await db.put('songBackgrounds', { id: songId, dataUrl });
};

// Playlists
export const getAllPlaylists = async (): Promise<Playlist[]> => {
  const db = await getDB();
  return db.getAll('playlists');
};

export const createPlaylist = async (name: string): Promise<void> => {
  const db = await getDB();
  const pl: Playlist = {
    id: Math.random().toString(36).substr(2, 9),
    name,
    songIds: [],
    createdAt: Date.now(),
  };
  await db.put('playlists', pl);
};

export const deletePlaylist = async (id: string): Promise<void> => {
  const db = await getDB();
  await db.delete('playlists', id);
};

export const updatePlaylist = async (playlist: Playlist): Promise<void> => {
  const db = await getDB();
  await db.put('playlists', playlist);
};
