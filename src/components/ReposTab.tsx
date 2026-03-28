import { useEffect, useState, useCallback } from "react";
import { getRepos, deleteRepo as apiDeleteRepo } from "@/lib/github";
import { FolderGit2, Lock, Globe, Search, Trash2, ChevronRight, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RepoBrowser } from "./RepoBrowser";

interface ReposTabProps {
  token: string;
  user: Record<string, unknown>;
}

export function ReposTab({ token, user }: ReposTabProps) {
  const [repos, setRepos] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRepos(token, 1, 100);
      setRepos(data);
    } catch {
      toast.error("Failed to load repos");
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (repo: Record<string, unknown>) => {
    const name = repo.name as string;
    if (!confirm(`Delete "${name}"? This cannot be undone!`)) return;
    try {
      await apiDeleteRepo(token, (user.login as string), name);
      toast.success(`Deleted ${name}`);
      setRepos((prev) => prev.filter((r) => r.name !== name));
    } catch {
      toast.error("Failed to delete repo. Check token permissions.");
    }
  };

  const filtered = repos.filter((r) =>
    (r.name as string).toLowerCase().includes(search.toLowerCase())
  );

  if (selectedRepo) {
    return (
      <RepoBrowser
        token={token}
        owner={(user.login as string)}
        repo={selectedRepo as { name: string; default_branch: string }}
        onBack={() => { setSelectedRepo(null); load(); }}
      />
    );
  }

  return (
    <div className="px-4 pt-4 pb-20 space-y-4 animate-slide-up">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search repos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-border"
          />
        </div>
        <Button size="icon" variant="ghost" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-card rounded-xl animate-pulse border border-border" />
          ))
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            {search ? "No repos match your search" : "No repositories found"}
          </p>
        ) : (
          filtered.map((repo) => {
            const r = repo as { name: string; private: boolean; language: string; description: string; updated_at: string; default_branch: string };
            return (
              <div
                key={r.name}
                className="bg-card rounded-xl border border-border overflow-hidden"
              >
                <button
                  onClick={() => setSelectedRepo(repo)}
                  className="w-full p-3 text-left flex items-center gap-3 hover:bg-secondary/50 transition-colors"
                >
                  <FolderGit2 className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{r.name}</span>
                      {r.private ? (
                        <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                      ) : (
                        <Globe className="h-3 w-3 text-accent shrink-0" />
                      )}
                    </div>
                    {r.description && (
                      <p className="text-xs text-muted-foreground truncate">{r.description}</p>
                    )}
                    <div className="flex gap-3 mt-0.5 text-[10px] text-muted-foreground">
                      {r.language && <span>{r.language}</span>}
                      <span>{new Date(r.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
                <div className="border-t border-border px-3 py-1.5 flex justify-end">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(repo); }}
                    className="text-xs text-destructive flex items-center gap-1 hover:underline"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
