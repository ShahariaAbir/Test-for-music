import { useState } from "react";
import { createRepo } from "@/lib/github";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FolderGit2, Lock, Globe } from "lucide-react";
import { toast } from "sonner";
import type { TabId } from "./BottomTabs";

interface CreateRepoTabProps {
  token: string;
  onNavigate: (tab: TabId) => void;
}

export function CreateRepoTab({ token, onNavigate }: CreateRepoTabProps) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createRepo(token, name.trim(), desc.trim(), isPrivate);
      toast.success(`Repository "${name}" created!`);
      setName("");
      setDesc("");
      onNavigate("repos");
    } catch (e) {
      toast.error((e as Error).message);
    }
    setLoading(false);
  };

  return (
    <div className="px-4 pt-4 pb-20 space-y-6 animate-slide-up">
      <div className="text-center space-y-2">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
          <FolderGit2 className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-lg font-bold">New Repository</h2>
        <p className="text-xs text-muted-foreground">Create a new GitHub repository</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Repository Name</Label>
          <Input
            placeholder="my-awesome-project"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-secondary border-border"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Description (optional)</Label>
          <Textarea
            placeholder="A short description..."
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="bg-secondary border-border resize-none h-20"
          />
        </div>

        <div className="flex items-center justify-between bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            {isPrivate ? <Lock className="h-5 w-5 text-muted-foreground" /> : <Globe className="h-5 w-5 text-accent" />}
            <div>
              <p className="text-sm font-medium">{isPrivate ? "Private" : "Public"}</p>
              <p className="text-[10px] text-muted-foreground">
                {isPrivate ? "Only you can see this repo" : "Anyone can see this repo"}
              </p>
            </div>
          </div>
          <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
        </div>

        <Button onClick={handleCreate} disabled={!name.trim() || loading} className="w-full">
          {loading ? "Creating..." : "Create Repository"}
        </Button>
      </div>
    </div>
  );
}
