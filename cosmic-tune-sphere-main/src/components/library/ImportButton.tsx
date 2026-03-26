import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FolderOpen, Loader2, CheckCircle2 } from 'lucide-react';
import { importSongs, getAllSongs, type Song } from '@/lib/db';
import { extractMetadataBatch } from '@/lib/metadata';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ImportButtonProps {
  onImported: () => void;
  blink?: boolean;
}

type ImportPhase = 'selecting' | 'processing' | 'saving' | 'done';
const SUPPORTED_AUDIO_EXTENSIONS = new Set([
  'mp3', 'wav', 'ogg', 'oga', 'm4a', 'flac', 'aac', 'wma', 'opus', 'mp4', 'm4b', 'm4p',
  'webm', 'weba', 'aiff', 'aif', 'alac', 'amr', 'mid', 'midi', 'ape', 'ac3', '3gp',
]);

const getFileExtension = (name: string) => {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? '';
};

const isAudioFile = (file: File) => {
  if (file.type.startsWith('audio/')) return true;
  return SUPPORTED_AUDIO_EXTENSIONS.has(getFileExtension(file.name));
};

export default function ImportButton({ onImported, blink }: ImportButtonProps) {
  const [phase, setPhase] = useState<ImportPhase | null>(null);
  const [progress, setProgress] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [showDialog, setShowDialog] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const [importedCount, setImportedCount] = useState(0);

  const isImporting = phase !== null && phase !== 'done';

  const processFiles = async (files: File[]) => {
    const audioFiles = files.filter(isAudioFile);

    if (audioFiles.length === 0) {
      alert('No audio files found. Please select MP3, WAV, FLAC, or other audio files.');
      setPhase(null);
      return;
    }

    setTotalFiles(audioFiles.length);
    setProgress(0);
    setSkipped(0);
    setImportedCount(0);
    setPhase('processing');

    try {
      const existingSongs = await getAllSongs();
      const existingKeys = new Set(
        existingSongs.map(s => s.fingerprint || s.importSignature).filter(Boolean)
      );

      // Extract metadata in parallel (10 concurrent for faster import)
      const metadataResults = await extractMetadataBatch(audioFiles, 10, (done) => {
        setProgress(done);
      });

      const allSongs: Song[] = [];
      const allBlobs = new Map<string, Blob>();
      let dupCount = 0;

      for (let i = 0; i < audioFiles.length; i++) {
        const meta = metadataResults[i];
        if (!meta) continue;

        const importSignature = `${audioFiles[i].name.toLowerCase()}|${audioFiles[i].size}|${audioFiles[i].lastModified}`;
        const key = meta.fingerprint || importSignature;
        if (existingKeys.has(key)) {
          dupCount++;
          continue;
        }
        existingKeys.add(key);

        const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 12) + Date.now().toString(36);
        const song: Song = {
          id,
          title: meta.title,
          artist: meta.artist,
          album: meta.album,
          duration: Math.round(meta.duration),
          fingerprint: meta.fingerprint,
          importSignature,
          url: '',
          coverUrl: '',
          isFavorite: false,
          addedAt: Date.now() + i,
        };
        allSongs.push(song);
        allBlobs.set(id, audioFiles[i]);
      }

      setSkipped(dupCount);

      // Write to DB in larger batches
      if (allSongs.length > 0) {
        setPhase('saving');
        setProgress(0);
        setTotalFiles(allSongs.length);
        const BATCH = 50;
        let written = 0;
        for (let i = 0; i < allSongs.length; i += BATCH) {
          const batchSongs = allSongs.slice(i, i + BATCH);
          const batchBlobs = new Map<string, Blob>();
          for (const s of batchSongs) {
            const b = allBlobs.get(s.id);
            if (b) batchBlobs.set(s.id, b);
          }
          await importSongs(batchSongs, batchBlobs);
          written += batchSongs.length;
          setProgress(written);
        }
      }

      setImportedCount(allSongs.length);
      setPhase('done');
      onImported();
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setPhase(null);
      setShowDialog(false);
    }
  };

  const handleSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = [
      'audio/*',
      ...Array.from(SUPPORTED_AUDIO_EXTENSIONS).map(ext => `.${ext}`),
    ].join(',');
    input.onchange = async () => {
      if (input.files && input.files.length > 0) {
        setPhase('selecting');
        setShowDialog(true);
        await processFiles(Array.from(input.files));
      }
    };
    input.click();
  };

  const handleClose = () => {
    if (phase === 'done' || !phase) {
      setShowDialog(false);
      setPhase(null);
    }
  };

  return (
    <>
      <Button
        onClick={handleSelect}
        variant="default"
        size="icon"
        disabled={isImporting}
        className={blink ? 'animate-pulse ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}
      >
        {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
      </Button>

      <Dialog open={showDialog} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {phase === 'done' ? 'Import Complete' : 'Importing Music'}
            </DialogTitle>
            <DialogDescription>
              {phase === 'selecting' && 'Preparing files...'}
              {phase === 'processing' && `Reading metadata: ${progress} of ${totalFiles} files...`}
              {phase === 'saving' && 'Saving to library...'}
              {phase === 'done' && '✓ All done!'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Progress */}
            {phase !== 'done' && (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--secondary))" strokeWidth="4" />
                    <circle
                      cx="32" cy="32" r="28" fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * (1 - (totalFiles ? progress / totalFiles : 0))}`}
                      className="transition-all duration-300"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    {phase === 'saving' ? (
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    ) : (
                      <span className="text-sm font-bold text-foreground">
                        {totalFiles ? Math.round((progress / totalFiles) * 100) : 0}%
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {phase === 'processing' && `${progress}/${totalFiles} files`}
                  {phase === 'saving' && `Writing to database... ${progress}/${totalFiles}`}
                  {phase === 'selecting' && 'Loading...'}
                </p>
              </div>
            )}

            {phase === 'done' && (
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle2 className="w-12 h-12 text-primary" />
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {importedCount} song{importedCount !== 1 ? 's' : ''} imported
                  </p>
                  {skipped > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {skipped} duplicate{skipped !== 1 ? 's' : ''} skipped
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
