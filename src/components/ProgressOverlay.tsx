import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import type { ProgressInfo } from "@/lib/github";

interface ProgressOverlayProps {
  label: string;
  progress: ProgressInfo | null;
}

export function ProgressOverlay({ label, progress }: ProgressOverlayProps) {
  if (!progress) return null;

  const percent = Math.round((progress.current / progress.total) * 100);
  const fileName = progress.currentFile.split("/").pop() || progress.currentFile;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
      <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-xl">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
          <span className="text-sm font-semibold">{label}</span>
        </div>

        <Progress value={percent} className="h-2" />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate max-w-[60%] font-mono">{fileName}</span>
          <span className="shrink-0 font-medium">
            {progress.current}/{progress.total} ({percent}%)
          </span>
        </div>
      </div>
    </div>
  );
}
