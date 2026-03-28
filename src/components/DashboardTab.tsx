import { useEffect, useState } from "react";
import { getRepos } from "@/lib/github";
import { FolderGit2, Star, GitFork, Lock, Globe, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TabId } from "./BottomTabs";

interface DashboardTabProps {
  token: string;
  user: Record<string, unknown>;
  onNavigate: (tab: TabId) => void;
}

export function DashboardTab({ token, user, onNavigate }: DashboardTabProps) {
  const [repos, setRepos] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getRepos(token, 1, 100);
      setRepos(data);
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [token]);

  const publicCount = repos.filter((r) => !(r as { private: boolean }).private).length;
  const privateCount = repos.filter((r) => (r as { private: boolean }).private).length;
  const totalStars = repos.reduce((s, r) => s + ((r as { stargazers_count: number }).stargazers_count || 0), 0);
  const totalForks = repos.reduce((s, r) => s + ((r as { forks_count: number }).forks_count || 0), 0);

  const recent = repos.slice(0, 5);

  return (
    <div className="px-4 pt-4 pb-20 space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <img
          src={(user.avatar_url as string) || ""}
          alt="avatar"
          className="w-12 h-12 rounded-full ring-2 ring-primary/30"
        />
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-lg truncate">{(user.login as string) || "User"}</h2>
          <p className="text-xs text-muted-foreground truncate">{(user.bio as string) || "GitHub Developer"}</p>
        </div>
        <Button size="icon" variant="ghost" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: FolderGit2, label: "Repos", value: repos.length, color: "text-primary" },
          { icon: Star, label: "Stars", value: totalStars, color: "text-warning" },
          { icon: Globe, label: "Public", value: publicCount, color: "text-accent" },
          { icon: Lock, label: "Private", value: privateCount, color: "text-muted-foreground" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`h-4 w-4 ${color}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Recent repos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Recent Repositories</h3>
          <button onClick={() => onNavigate("repos")} className="text-xs text-primary">
            View all →
          </button>
        </div>
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-card rounded-xl animate-pulse border border-border" />
            ))
          ) : recent.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No repositories yet</p>
          ) : (
            recent.map((repo) => {
              const r = repo as { name: string; private: boolean; language: string; stargazers_count: number; forks_count: number; description: string };
              return (
                <button
                  key={r.name}
                  onClick={() => onNavigate("repos")}
                  className="w-full bg-card rounded-xl p-3 border border-border text-left hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FolderGit2 className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium text-sm truncate">{r.name}</span>
                    {r.private ? (
                      <Lock className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
                    ) : (
                      <Globe className="h-3 w-3 text-accent ml-auto shrink-0" />
                    )}
                  </div>
                  {r.description && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{r.description}</p>
                  )}
                  <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                    {r.language && <span>{r.language}</span>}
                    {r.stargazers_count > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Star className="h-3 w-3" /> {r.stargazers_count}
                      </span>
                    )}
                    {r.forks_count > 0 && (
                      <span className="flex items-center gap-0.5">
                        <GitFork className="h-3 w-3" /> {r.forks_count}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
