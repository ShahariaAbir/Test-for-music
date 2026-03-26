export interface ExtractedMetadata {
  title: string;
  artist: string;
  album: string;
  duration: number;
  fingerprint?: string;
}

export async function extractMetadata(file: File): Promise<ExtractedMetadata> {
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const parsed = parseTitleArtistFromFilename(baseName);
  const title = parsed.title;
  const artist = parsed.artist;
  const album = 'Unknown Album';
  let duration = 0;
  let fingerprint = '';

  try {
    const [resolvedDuration, resolvedFingerprint] = await Promise.all([
      getAudioDuration(file),
      createAudioFingerprint(file),
    ]);
    duration = resolvedDuration;
    fingerprint = resolvedFingerprint;
  } catch {
    duration = 0;
  }

  return { title, artist, album, duration, fingerprint };
}

function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);

    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      audio.src = '';
      resolve(180);
    }, 2000);

    audio.addEventListener('loadedmetadata', () => {
      clearTimeout(timeout);
      const d = audio.duration;
      URL.revokeObjectURL(url);
      audio.src = '';
      resolve(isFinite(d) ? d : 180);
    });

    audio.addEventListener('error', () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      audio.src = '';
      resolve(180);
    });

    audio.preload = 'metadata';
    audio.src = url;
  });
}

async function createAudioFingerprint(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (bytes.length === 0) return '';

  const windowSize = Math.min(2048, bytes.length);
  const slices: number[] = [];
  const starts = [0, Math.max(0, Math.floor(bytes.length / 2) - Math.floor(windowSize / 2)), Math.max(0, bytes.length - windowSize)];

  for (const start of starts) {
    for (let i = 0; i < windowSize; i++) {
      slices.push(bytes[start + i] ?? 0);
    }
  }

  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(slices));
  const hash = Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');

  return hash;
}

function parseTitleArtistFromFilename(baseName: string): { title: string; artist: string } {
  const cleaned = baseName.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();

  const separators = [' - ', ' – ', ' — ', ' | '];
  for (const separator of separators) {
    if (cleaned.includes(separator)) {
      const [left, ...rest] = cleaned.split(separator);
      const right = rest.join(separator).trim();
      if (left.trim() && right) {
        return {
          artist: left.trim(),
          title: right,
        };
      }
    }
  }

  return {
    title: cleaned || 'Unknown Title',
    artist: 'Unknown Artist',
  };
}

/**
 * Extract metadata from multiple files in parallel with concurrency limit.
 */
export async function extractMetadataBatch(
  files: File[],
  concurrency: number = 6,
  onProgress?: (done: number) => void,
): Promise<(ExtractedMetadata | null)[]> {
  const results: (ExtractedMetadata | null)[] = new Array(files.length).fill(null);
  let nextIndex = 0;
  let completed = 0;

  async function worker() {
    while (nextIndex < files.length) {
      const i = nextIndex++;
      try {
        results[i] = await extractMetadata(files[i]);
      } catch {
        results[i] = null;
      }
      completed++;
      onProgress?.(completed);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, files.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
