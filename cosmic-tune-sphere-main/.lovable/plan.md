

# 🎵 Offline Music Player PWA

## Overview
A modern, futuristic offline music player as a Progressive Web App. Users import music files from their device, and the app plays them with a real-time bar spectrum visualizer — all offline, no server needed.

---

## 1. PWA Setup & Installation
- Configure the app as a full PWA with offline support, app manifest, and icons
- Add an **Install page** (`/install`) guiding users to add the app to their home screen
- Service worker caches all app assets for complete offline functionality

## 2. Music Import & Storage
- **Folder/file picker** button lets users select multiple music files at once
- Imported songs are stored in the browser's **IndexedDB** so they persist across sessions — no need to re-import
- Reads metadata (title, artist, album, duration) from audio files when available
- Users can add more files or remove existing ones anytime

## 3. Song Library UI (Minimal Dark Theme)
- Clean dark background with subtle gradients and accent color highlights
- **Song list view** showing title, artist, album, and duration for each track
- **Search bar** to filter songs by name, artist, or album
- **Sort options** (by name, artist, recently added)
- Smooth animations and transitions throughout

## 4. Player & Controls
- **Now Playing** bar at the bottom with album art placeholder, song title, and artist
- Full playback controls: play/pause, next, previous, seek bar with time display
- **Shuffle mode** and **repeat modes** (off, repeat one, repeat all)
- Volume control slider
- Tap the Now Playing bar to expand into a **full-screen player view**

## 5. Bar Spectrum Visualizer
- Real-time audio frequency visualizer using the Web Audio API
- Animated vertical bars that react to the music being played
- Displayed prominently in the full-screen player view
- Glowing accent-colored bars on the dark background for a futuristic feel

## 6. Playlists
- Create, rename, and delete custom playlists
- Add/remove songs to playlists from the library
- Dedicated playlist view to browse and play from playlists

## 7. Favorites
- Heart icon on each song to mark/unmark as favorite
- Dedicated **Favorites** section for quick access to liked songs

## 8. Navigation
- Bottom tab navigation: **Library**, **Playlists**, **Favorites**
- Persistent Now Playing mini-bar above the navigation tabs
- All data stored locally in IndexedDB — works fully offline

