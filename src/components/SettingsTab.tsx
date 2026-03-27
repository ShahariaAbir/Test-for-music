import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, LogOut, Eye, EyeOff, RefreshCw } from "lucide-react";

interface SettingsTabProps {
  token: string;
  user: Record<string, unknown>;
  onUpdateToken: (token: string) => void;
  onDisconnect: () => void;
}

export function SettingsTab({ token, user, onUpdateToken, onDisconnect }: SettingsTabProps) {
  const [newToken, setNewToken] = useState("");
  const [show, setShow] = useState(false);
  const [updating, setUpdating] = useState(false);

  const handleUpdate = async () => {
    if (!newToken.trim()) return;
    setUpdating(true);
    await new Promise((r) => setTimeout(r, 500));
    onUpdateToken(newToken.trim());
    setNewToken("");
    setUpdating(false);
  };

  const masked = token.slice(0, 6) + "•".repeat(20) + token.slice(-4);

  return (
    <div className="px-4 pt-4 pb-20 space-y-6 animate-slide-up">
      <div className="text-center space-y-2">
        <img
          src={(user.avatar_url as string) || ""}
          alt="avatar"
          className="w-16 h-16 rounded-full ring-2 ring-primary/30 mx-auto"
        />
        <h2 className="font-bold text-lg">{(user.login as string) || "User"}</h2>
        <p className="text-xs text-muted-foreground">{(user.email as string) || "Connected via token"}</p>
      </div>

      {/* Current token */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Access Token</span>
        </div>
        <div className="flex items-center gap-2">
          <code className="text-xs font-mono bg-secondary rounded px-2 py-1 flex-1 truncate">
            {show ? token : masked}
          </code>
          <button onClick={() => setShow(!show)} className="text-muted-foreground">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Update token */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium">Update Token</span>
        </div>
        <Input
          type="password"
          placeholder="Paste new token..."
          value={newToken}
          onChange={(e) => setNewToken(e.target.value)}
          className="bg-secondary border-border font-mono text-sm"
        />
        <Button onClick={handleUpdate} disabled={!newToken.trim() || updating} className="w-full" variant="secondary">
          {updating ? "Updating..." : "Update Token"}
        </Button>
      </div>

      {/* Disconnect */}
      <Button onClick={onDisconnect} variant="destructive" className="w-full">
        <LogOut className="h-4 w-4 mr-2" />
        Disconnect
      </Button>
    </div>
  );
}
