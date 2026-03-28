import { LayoutDashboard, FolderGit2, PlusCircle, BookOpen, Settings } from "lucide-react";

const tabs = [
  { id: "dashboard", label: "Home", icon: LayoutDashboard },
  { id: "repos", label: "Repos", icon: FolderGit2 },
  { id: "create", label: "Create", icon: PlusCircle },
  { id: "guide", label: "Guide", icon: BookOpen },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export type TabId = (typeof tabs)[number]["id"];

interface BottomTabsProps {
  active: TabId;
  onChange: (id: TabId) => void;
}

export function BottomTabs({ active, onChange }: BottomTabsProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card safe-bottom">
      <div className="flex justify-around items-center h-14 max-w-lg mx-auto">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`flex flex-col items-center gap-0.5 flex-1 py-1 transition-colors ${
                isActive ? "text-tab-active" : "text-tab-inactive"
              }`}
            >
              <Icon className={`h-5 w-5 ${id === "create" && isActive ? "scale-110" : ""}`} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
