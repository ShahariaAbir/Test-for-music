const LYRICS_STORAGE_KEY = 'nova_lyrics_';
const FINGERPRINT_DETAILS_KEY = 'nova_track_details_';
const AUDD_API_TOKEN = import.meta.env.VITE_AUDD_API_TOKEN as string | undefined;

function getLyricsKey(title: string, artist: string): string {
  return `${LYRICS_STORAGE_KEY}${title.toLowerCase().trim()}__${artist.toLowerCase().trim()}`;
}

export function getSavedLyrics(title: string, artist: string): string | null {
  try {
    return localStorage.getItem(getLyricsKey(title, artist));
  } catch {
    return null;
  }
}

export function saveLyrics(title: string, artist: string, lyrics: string): void {
  try {
    localStorage.setItem(getLyricsKey(title, artist), lyrics);
  } catch {}
}

export function clearSavedLyrics(title: string, artist: string): void {
  try {
    localStorage.removeItem(getLyricsKey(title, artist));
  } catch {}
}

async function fetchLyricsFromLrclib(title: string, artist: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      artist_name: artist,
      track_name: title,
    });
    const res = await fetch(`https://lrclib.net/api/get?${params}`, {
      headers: { 'User-Agent': 'NovaPlayer/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.plainLyrics || data.syncedLyrics || null;
  } catch {
    return null;
  }
}

export async function fetchLyrics(title: string, artist: string): Promise<string | null> {
  return fetchLyricsFromLrclib(title, artist);
}

export interface TrackDetails {
  title: string;
  artist: string;
  album?: string;
}

export interface LyricsResolveResult {
  lyrics: string | null;
  resolvedTrack: TrackDetails;
}

export function saveTrackDetailsForFingerprint(fingerprint: string, details: TrackDetails): void {
  if (!fingerprint) return;
  try {
    localStorage.setItem(`${FINGERPRINT_DETAILS_KEY}${fingerprint}`, JSON.stringify(details));
  } catch {}
}

export function getTrackDetailsForFingerprint(fingerprint: string): TrackDetails | null {
  if (!fingerprint) return null;
  try {
    const raw = localStorage.getItem(`${FINGERPRINT_DETAILS_KEY}${fingerprint}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TrackDetails;
    if (!parsed?.title || !parsed?.artist) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function identifyTrackByFingerprint(
  fingerprint: string,
  fallbackTitle: string,
  fallbackArtist: string,
): Promise<TrackDetails> {
  const cached = getTrackDetailsForFingerprint(fingerprint);
  if (cached) return cached;

  const query = `${fallbackArtist} ${fallbackTitle}`.trim();
  if (!query) {
    return { title: fallbackTitle, artist: fallbackArtist };
  }

  try {
    const params = new URLSearchParams({
      term: query,
      entity: 'song',
      limit: '1',
    });
    const res = await fetch(`https://itunes.apple.com/search?${params}`);
    if (res.ok) {
      const data = await res.json();
      const first = data?.results?.[0];
      if (first?.trackName && first?.artistName) {
        const details: TrackDetails = {
          title: first.trackName,
          artist: first.artistName,
          album: first.collectionName || undefined,
        };
        saveTrackDetailsForFingerprint(fingerprint, details);
        return details;
      }
    }
  } catch {
    // Silent fallback to file-derived metadata.
  }

  const fallback = { title: fallbackTitle, artist: fallbackArtist };
  saveTrackDetailsForFingerprint(fingerprint, fallback);
  return fallback;
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples * blockAlign;
  const wavSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(wavSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channelData: Float32Array[] = [];
  for (let c = 0; c < channels; c++) {
    channelData.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < channels; c++) {
      const sample = Math.max(-1, Math.min(1, channelData[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

async function createMidSnippetBlob(sourceAudio: Blob, clipSeconds = 20): Promise<Blob | null> {
  try {
    const context = new AudioContext();
    const rawBuffer = await sourceAudio.arrayBuffer();
    const decoded = await context.decodeAudioData(rawBuffer.slice(0));

    const totalDuration = decoded.duration || 0;
    const actualLengthSec = Math.min(clipSeconds, totalDuration || clipSeconds);
    const startSec = Math.max(0, (totalDuration - actualLengthSec) / 2);

    const startSample = Math.floor(startSec * decoded.sampleRate);
    const endSample = Math.min(decoded.length, startSample + Math.floor(actualLengthSec * decoded.sampleRate));
    const frameCount = Math.max(1, endSample - startSample);

    const clipped = context.createBuffer(
      decoded.numberOfChannels,
      frameCount,
      decoded.sampleRate,
    );

    for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
      const src = decoded.getChannelData(channel).subarray(startSample, endSample);
      clipped.copyToChannel(src, channel, 0);
    }

    await context.close();
    return audioBufferToWavBlob(clipped);
  } catch {
    return null;
  }
}

async function identifyTrackWithAudd(audio: Blob): Promise<TrackDetails | null> {
  if (!AUDD_API_TOKEN) return null;

  const snippet = await createMidSnippetBlob(audio, 20);
  if (!snippet) return null;

  const formData = new FormData();
  formData.append('api_token', AUDD_API_TOKEN);
  formData.append('return', 'apple_music,spotify,deezer,lyrics');
  formData.append('file', snippet, 'snippet.wav');

  try {
    const response = await fetch('https://api.audd.io/', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) return null;
    const payload = await response.json();
    const result = payload?.result;
    if (!result?.title || !result?.artist) return null;

    return {
      title: String(result.title),
      artist: String(result.artist),
      album: result.album ? String(result.album) : undefined,
    };
  } catch {
    return null;
  }
}

export async function resolveLyricsFromAudio(
  songId: string,
  title: string,
  artist: string,
  getAudioBlobById: (id: string) => Promise<Blob | undefined>,
): Promise<LyricsResolveResult> {
  let resolvedTrack: TrackDetails = { title, artist };

  const audio = await getAudioBlobById(songId);
  if (audio) {
    const identified = await identifyTrackWithAudd(audio);
    if (identified) {
      resolvedTrack = identified;
    }
  }

  const lyrics = await fetchLyricsFromLrclib(resolvedTrack.title, resolvedTrack.artist)
    || await fetchLyricsFromLrclib(title, artist);

  return {
    lyrics,
    resolvedTrack,
  };
}
